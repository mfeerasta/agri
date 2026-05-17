/**
 * Crop disease diagnostic endpoint.
 *
 * POST: accepts JSON body { imageUrl, fieldId, cropPlanId?, stageLogId?, observedOn?,
 * cropName?, stage?, fieldHistoryHints? } OR multipart form-data with a `file`
 * (uploaded to Supabase storage) plus the same fields. Calls Claude vision via
 * diagnoseCropPhoto, inserts a zameen.crop_diagnostics row, and returns the row.
 *
 * Rate limit: 20 calls per user per hour.
 */

import { NextResponse } from 'next/server';
import { db, cropDiagnostics, cropPlans, cropProfiles } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { cropDiagnosticCreateSchema, diagnoseCropPhoto } from '@zameen/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const BUCKET = 'zameen-receipts';
const RATE_LIMIT_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = userData.user.id;
  const rl = rateLimit(`diagnostics:${userId}`, RATE_LIMIT_PER_HOUR, HOUR_MS);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 });
  }

  let imageUrl: string | undefined;
  let fieldId: string | undefined;
  let cropPlanId: string | undefined;
  let stageLogId: string | undefined;
  let observedOn: string | undefined;
  let cropName: string | undefined;
  let stage: string | undefined;
  let fieldHistoryHints: string | undefined;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    const path = `${userId}/diagnostics/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    fieldId = String(form.get('fieldId') ?? '');
    cropPlanId = (form.get('cropPlanId') as string) || undefined;
    stageLogId = (form.get('stageLogId') as string) || undefined;
    observedOn = (form.get('observedOn') as string) || undefined;
    cropName = (form.get('cropName') as string) || undefined;
    stage = (form.get('stage') as string) || undefined;
    fieldHistoryHints = (form.get('fieldHistoryHints') as string) || undefined;
  } else {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    imageUrl = body.imageUrl as string | undefined;
    fieldId = body.fieldId as string | undefined;
    cropPlanId = body.cropPlanId as string | undefined;
    stageLogId = body.stageLogId as string | undefined;
    observedOn = body.observedOn as string | undefined;
    cropName = body.cropName as string | undefined;
    stage = body.stage as string | undefined;
    fieldHistoryHints = body.fieldHistoryHints as string | undefined;
  }

  const parsed = cropDiagnosticCreateSchema.safeParse({
    imageUrl,
    fieldId,
    cropPlanId,
    stageLogId,
    observedOn,
    cropName,
    stage,
    fieldHistoryHints,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', detail: parsed.error.message }, { status: 400 });
  }

  let effectiveCrop = parsed.data.cropName;
  let effectiveStage = parsed.data.stage;
  if (parsed.data.cropPlanId && (!effectiveCrop || !effectiveStage)) {
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
      effectiveCrop = effectiveCrop ?? plan.cropName ?? undefined;
      effectiveStage = effectiveStage ?? plan.stage ?? undefined;
    }
  }

  const diag = await diagnoseCropPhoto({
    imageUrl: parsed.data.imageUrl,
    cropName: effectiveCrop,
    stage: effectiveStage,
    fieldHistoryHints: parsed.data.fieldHistoryHints,
  });

  const observedOnDate = parsed.data.observedOn ?? new Date().toISOString().slice(0, 10);

  const [row] = await db
    .insert(cropDiagnostics)
    .values({
      fieldId: parsed.data.fieldId,
      cropPlanId: parsed.data.cropPlanId ?? null,
      stageLogId: parsed.data.stageLogId ?? null,
      photoUrl: parsed.data.imageUrl,
      observedOn: observedOnDate,
      reportedBy: userId,
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
