/**
 * POST /api/ai/search
 *
 * Hybrid search: text matching across the most relevant entity tables, then
 * Claude synthesizes a natural-language answer with citations. Phase 1 uses
 * LIKE / ilike server-side; vector index lands in Phase 2.
 *
 * Body: { query: string }
 * Returns: { answer: string, citations: Citation[] }
 */

import { z } from 'zod';
import { ilike, or, eq, desc, and } from 'drizzle-orm';
import {
  db,
  fields,
  cropPlans,
  cropProfiles,
  vendors,
  workers,
  journalEntries,
  approvalRequests,
} from '@zameen/db';
import { complete, HOUSE_STYLE, logAiCall, summarizePrompt } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ query: z.string().min(1).max(500) });

interface Citation {
  kind: 'field' | 'crop_plan' | 'vendor' | 'worker' | 'journal_entry' | 'approval_request';
  id: string;
  label: string;
  deepLink: string;
}

interface SearchHit {
  citation: Citation;
  snippet: string;
}

async function gather(q: string, entityId: string): Promise<SearchHit[]> {
  const like = `%${q}%`;
  const hits: SearchHit[] = [];

  // Fields
  try {
    const rows = await db
      .select({ id: fields.id, code: fields.code, name: fields.name, acres: fields.acres })
      .from(fields)
      .where(or(ilike(fields.code, like), ilike(fields.name, like)))
      .limit(5);
    for (const r of rows) {
      hits.push({
        citation: {
          kind: 'field',
          id: r.id,
          label: `${r.code} ${r.name ?? ''}`.trim(),
          deepLink: `/fields/${r.id}`,
        },
        snippet: `Field ${r.code} (${r.name ?? 'unnamed'}), ${r.acres} acres`,
      });
    }
  } catch {
    // ignore
  }

  // Crop plans
  try {
    const rows = await db
      .select({
        id: cropPlans.id,
        seasonLabel: cropPlans.seasonLabel,
        variety: cropPlans.varietyName,
        crop: cropProfiles.name,
        stage: cropPlans.currentStage,
      })
      .from(cropPlans)
      .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
      .where(or(ilike(cropProfiles.name, like), ilike(cropPlans.varietyName, like), ilike(cropPlans.seasonLabel, like)))
      .limit(5);
    for (const r of rows) {
      hits.push({
        citation: {
          kind: 'crop_plan',
          id: r.id,
          label: `${r.crop ?? 'crop'} ${r.seasonLabel}`,
          deepLink: `/crops/plans/${r.id}`,
        },
        snippet: `Crop plan: ${r.crop ?? 'unknown'} ${r.variety ?? ''} ${r.seasonLabel}, stage ${r.stage}`,
      });
    }
  } catch {
    // ignore
  }

  // Vendors
  try {
    const rows = await db
      .select({ id: vendors.id, name: vendors.name, kind: vendors.kind })
      .from(vendors)
      .where(and(eq(vendors.entityId, entityId), ilike(vendors.name, like)))
      .limit(5);
    for (const r of rows) {
      hits.push({
        citation: {
          kind: 'vendor',
          id: r.id,
          label: r.name,
          deepLink: `/procurement/vendors/${r.id}`,
        },
        snippet: `Vendor ${r.name} (${r.kind})`,
      });
    }
  } catch {
    // ignore
  }

  // Workers
  try {
    const rows = await db
      .select({ id: workers.id, name: workers.name, role: workers.role })
      .from(workers)
      .where(ilike(workers.name, like))
      .limit(5);
    for (const r of rows) {
      hits.push({
        citation: {
          kind: 'worker',
          id: r.id,
          label: r.name,
          deepLink: `/labor/workers/${r.id}`,
        },
        snippet: `Worker ${r.name} (${r.role ?? 'unknown role'})`,
      });
    }
  } catch {
    // ignore
  }

  // Approval requests
  try {
    const rows = await db
      .select({
        id: approvalRequests.id,
        title: approvalRequests.title,
        state: approvalRequests.state,
        amount: approvalRequests.amountPkr,
      })
      .from(approvalRequests)
      .where(and(eq(approvalRequests.entityId, entityId), ilike(approvalRequests.title, like)))
      .orderBy(desc(approvalRequests.createdAt))
      .limit(5);
    for (const r of rows) {
      hits.push({
        citation: {
          kind: 'approval_request',
          id: r.id,
          label: r.title,
          deepLink: `/approvals/${r.id}`,
        },
        snippet: `Approval: ${r.title}, state ${r.state}, amount ${r.amount ?? '0'} PKR`,
      });
    }
  } catch {
    // ignore
  }

  // Recent journal entries
  try {
    const rows = await db
      .select({
        id: journalEntries.id,
        narration: journalEntries.narration,
        postedAt: journalEntries.postedAt,
      })
      .from(journalEntries)
      .where(and(eq(journalEntries.entityId, entityId), ilike(journalEntries.narration, like)))
      .orderBy(desc(journalEntries.postedAt))
      .limit(5);
    for (const r of rows) {
      hits.push({
        citation: {
          kind: 'journal_entry',
          id: r.id,
          label: r.narration ?? 'journal entry',
          deepLink: `/finance/journal/${r.id}`,
        },
        snippet: `Journal: ${r.narration ?? ''}`,
      });
    }
  } catch {
    // ignore
  }

  return hits.slice(0, 12);
}

const SYSTEM = [
  'You are Zameen search. The user has asked a question about their farm data.',
  'You are given up to 12 matched records as context. Answer the question using only these records.',
  'If the records do not answer the question, say so plainly and suggest a section to check.',
  'Keep your answer to 3 sentences or less. Refer to records by their label, never by uuid.',
  HOUSE_STYLE,
].join('\n\n');

export async function POST(req: Request): Promise<Response> {
  const session = await getSessionContext();
  if (!session) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const limit = rateLimit(`ai-search:${session.userId}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  const startedAt = Date.now();
  const hits = await gather(parsed.data.query, session.entityId);
  const context = hits
    .map((h, i) => `[${i + 1}] (${h.citation.kind}) ${h.citation.label}: ${h.snippet}`)
    .join('\n');

  const userPrompt = [
    `Question: ${parsed.data.query}`,
    '',
    'Records:',
    context || '(no matching records found)',
  ].join('\n');

  const result = await complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 512,
    temperature: 0.3,
  });

  void logAiCall(db, {
    kind: 'search',
    userId: session.userId,
    entityId: session.entityId,
    promptSummary: summarizePrompt(parsed.data.query),
    inputTokens: result.usage.input,
    outputTokens: result.usage.output,
    latencyMs: Date.now() - startedAt,
    model: process.env.ZAMEEN_CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022',
  });

  return Response.json({
    answer: result.text || 'No relevant records found.',
    citations: hits.map((h) => h.citation),
  });
}
