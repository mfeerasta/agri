/**
 * Trigger diagnostics backfill for stage-log photos that don't have a
 * matching crop_diagnostics row yet. Limited to 100 photos per click.
 * For larger backfills, call the supabase/functions/diagnostics-backfill
 * edge function directly.
 */

import { NextResponse } from 'next/server';
import { db, cropStageLogs, cropDiagnostics, cropPlans } from '@zameen/db';
import { eq, sql } from 'drizzle-orm';
import { diagnoseCropPhoto } from '@zameen/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_PHOTOS = 100;

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const candidates = await db
    .select({
      stageLogId: cropStageLogs.id,
      cropPlanId: cropStageLogs.cropPlanId,
      observedOn: cropStageLogs.observedOn,
      photoUrls: cropStageLogs.photoUrls,
      fieldId: cropPlans.fieldId,
    })
    .from(cropStageLogs)
    .leftJoin(cropPlans, eq(cropPlans.id, cropStageLogs.cropPlanId))
    .where(sql`jsonb_array_length(${cropStageLogs.photoUrls}) > 0`)
    .limit(500);

  const existing = await db.select({ photoUrl: cropDiagnostics.photoUrl }).from(cropDiagnostics);
  const alreadyDone = new Set(existing.map((e) => e.photoUrl));

  let processed = 0;
  for (const cand of candidates) {
    if (processed >= MAX_PHOTOS) break;
    if (!cand.fieldId) continue;
    const photos = (cand.photoUrls ?? []) as string[];
    for (const url of photos) {
      if (processed >= MAX_PHOTOS) break;
      if (alreadyDone.has(url)) continue;
      const diag = await diagnoseCropPhoto({ imageUrl: url });
      await db.insert(cropDiagnostics).values({
        fieldId: cand.fieldId,
        cropPlanId: cand.cropPlanId,
        stageLogId: cand.stageLogId,
        photoUrl: url,
        observedOn: cand.observedOn.toISOString().slice(0, 10),
        reportedBy: userData.user.id,
        diagnosisLabel: diag.diagnosisLabel,
        confidence: diag.confidence.toFixed(4),
        severity: diag.severity,
        treatmentSuggestion: diag.treatmentSuggestion,
        treatmentSuggestionUr: diag.treatmentSuggestionUr,
        alternativeDiagnoses: diag.alternativeDiagnoses,
        source: 'claude_vision',
        status: 'pending_review',
        rawResponse: diag as unknown as Record<string, unknown>,
      });
      processed += 1;
    }
  }

  return NextResponse.json({ processed });
}
