/**
 * Field PWA crop disease diagnostic endpoint. Mirrors the web endpoint with
 * the same shape so the offline queue can post here too.
 */

import { NextResponse } from 'next/server';
import { db, cropDiagnostics, cropPlans, cropProfiles } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { cropDiagnosticCreateSchema, diagnoseCropPhoto } from '@zameen/shared';
import { getFieldSession } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

function rateLimit(key: string): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const existing = RATE_BUCKETS.get(key);
  if (!existing || existing.resetAt <= now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + HOUR_MS });
    return { allowed: true, resetAt: now + HOUR_MS };
  }
  if (existing.count >= RATE_LIMIT_PER_HOUR) return { allowed: false, resetAt: existing.resetAt };
  existing.count += 1;
  return { allowed: true, resetAt: existing.resetAt };
}

export async function POST(req: Request): Promise<Response> {
  const session = await getFieldSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = rateLimit(`diag:${session.userId}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const parsed = cropDiagnosticCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', detail: parsed.error.message }, { status: 400 });
  }

  let cropName = parsed.data.cropName;
  let stage = parsed.data.stage;
  if (parsed.data.cropPlanId && (!cropName || !stage)) {
    const [plan] = await db
      .select({
        cropName: cropProfiles.name,
        stage: cropPlans.currentStage,
      })
      .from(cropPlans)
      .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
      .where(eq(cropPlans.id, parsed.data.cropPlanId))
      .limit(1);
    if (plan) {
      cropName = cropName ?? plan.cropName ?? undefined;
      stage = stage ?? plan.stage ?? undefined;
    }
  }

  const diag = await diagnoseCropPhoto({
    imageUrl: parsed.data.imageUrl,
    cropName,
    stage,
    fieldHistoryHints: parsed.data.fieldHistoryHints,
  });

  const observedOn = parsed.data.observedOn ?? new Date().toISOString().slice(0, 10);

  const [row] = await db
    .insert(cropDiagnostics)
    .values({
      fieldId: parsed.data.fieldId,
      cropPlanId: parsed.data.cropPlanId ?? null,
      stageLogId: parsed.data.stageLogId ?? null,
      photoUrl: parsed.data.imageUrl,
      observedOn,
      reportedBy: session.userId,
      diagnosisLabel: diag.diagnosisLabel,
      confidence: diag.confidence.toFixed(4),
      severity: diag.severity,
      treatmentSuggestion: diag.treatmentSuggestion,
      treatmentSuggestionUr: diag.treatmentSuggestionUr,
      alternativeDiagnoses: diag.alternativeDiagnoses,
      source: 'claude_vision',
      status: 'pending_review',
      rawResponse: diag as unknown as Record<string, unknown>,
    })
    .returning();

  return NextResponse.json({ diagnostic: row, diagnosis: diag });
}
