/**
 * GET /api/ai/approval-explainer/[id]
 *
 * Claude-generated 2-sentence "why this matters" summary for an approval
 * request. Reads the approvalRequests row + its contextSnapshot, asks Claude
 * to surface red flags and comparable context. Cached 24h.
 */

import { eq, sql } from 'drizzle-orm';
import { db, approvalRequests } from '@zameen/db';
import type { ApprovalContextSnapshot } from '@zameen/approvals';
import { complete, HOUSE_STYLE, logAiCall, summarizePrompt } from '@zameen/shared';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExplainerPayload {
  summary: string;
  redFlags: string[] | null;
  comparableContext: string | null;
}

function emptyPayload(): ExplainerPayload {
  return { summary: '', redFlags: null, comparableContext: null };
}

// In-memory token bucket (single-instance). Mirrors web app's rate-limit.ts.
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

const SYSTEM = [
  'You explain pending approval requests on a Pakistani farm in plain English.',
  'Output strict JSON only:',
  '{ "summary": string, "redFlags": string[] | null, "comparableContext": string | null }',
  'Rules:',
  '- summary is exactly 2 sentences. Plain English. Tell the approver what is being decided and the one thing they should weigh most.',
  '- redFlags: 0 to 3 short concerns from the context (low cash, recent similar rejections, vendor first time). null if none.',
  '- comparableContext: a one-sentence comparison versus recent similar approvals, or null.',
  '- All amounts in PKR. Format with Indian commas (e.g., 1,25,000).',
  HOUSE_STYLE,
].join('\n\n');

async function readCache(id: string): Promise<ExplainerPayload | null> {
  try {
    const rows = await db.execute(sql`
      select payload from zameen.ai_advisor_cache
      where kind = 'approval_explainer' and key = ${id} and expires_at > now()
      limit 1
    `);
    const arr = rows as unknown as Array<{ payload: ExplainerPayload }>;
    return arr[0]?.payload ?? null;
  } catch {
    return null;
  }
}

async function writeCache(id: string, payload: ExplainerPayload): Promise<void> {
  try {
    const json = JSON.stringify(payload);
    await db.execute(sql`
      insert into zameen.ai_advisor_cache (kind, key, payload, expires_at)
      values ('approval_explainer', ${id}, ${json}::jsonb, now() + interval '24 hours')
      on conflict (kind, key) do update set payload = excluded.payload, expires_at = excluded.expires_at
    `);
  } catch {
    // best-effort
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await ctx.params;

  const cached = await readCache(id);
  if (cached) {
    return Response.json({ ...cached, cached: true });
  }

  if (!rateLimit(`explainer:${auth.user.id}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1);
  if (!req) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const ctxSnap = (req.contextSnapshot ?? {}) as ApprovalContextSnapshot;
  const userPrompt = [
    `Approval title: ${req.title}`,
    `Type: ${req.approvalType}`,
    `Amount PKR: ${req.amountPkr ?? '0'}`,
    `State: ${req.state}`,
    `Source: ${req.sourceModule}/${req.sourceRecordId}`,
    `Context snapshot: ${JSON.stringify(ctxSnap).slice(0, 6000)}`,
    '',
    'Return JSON only.',
  ].join('\n');

  const startedAt = Date.now();
  const result = await complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 512,
    temperature: 0.3,
  });

  let parsed: ExplainerPayload;
  try {
    parsed = JSON.parse(result.text) as ExplainerPayload;
    if (typeof parsed.summary !== 'string') throw new Error('bad shape');
  } catch {
    parsed = emptyPayload();
  }

  void logAiCall(db, {
    kind: 'approval_explainer',
    userId: auth.user.id,
    entityId: req.entityId,
    promptSummary: summarizePrompt(req.title),
    inputTokens: result.usage.input,
    outputTokens: result.usage.output,
    latencyMs: Date.now() - startedAt,
    model: process.env.ZAMEEN_CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022',
  });

  if (parsed.summary) await writeCache(id, parsed);

  return Response.json(parsed);
}
