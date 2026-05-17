// daily-task-generator
// Schedule: pg_cron at 04:00 PKT (23:00 UTC previous day).
// Reads zameen.crop_plans + zameen.crop_profiles.stage_timeline and inserts
// zameen.tasks rows for today + tomorrow for every active field plan.

import { getServiceClient, jsonResponse, pktTodayIso, pktAddDays } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
interface StageTimelineEntry {
  stage: string;
  dayOffset: number;
  taskKind: string;
  title: string;
  titleUr?: string;
  estimatedHours?: number;
}

interface CropPlanRow {
  id: string;
  entity_id: string;
  field_id: string;
  actual_sowing_date: string | null;
  planned_sowing_date: string | null;
  crop_profile_id: string;
  current_stage: string;
}

interface CropProfileRow {
  id: string;
  stage_timeline: StageTimelineEntry[] | null;
}

Deno.serve(instrument('daily-task-generator', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();
  const tomorrow = pktAddDays(today, 1);
  const targetDates = [today, tomorrow];

  const { data: plans, error: pErr } = await supabase
    .from('crop_plans')
    .select('id, entity_id, field_id, actual_sowing_date, planned_sowing_date, crop_profile_id, current_stage')
    .neq('current_stage', 'post_harvest');

  if (pErr) return jsonResponse({ error: pErr.message }, 500);

  const profileIds = Array.from(new Set((plans ?? []).map((p) => (p as CropPlanRow).crop_profile_id)));
  if (profileIds.length === 0) return jsonResponse({ generated: 0 });

  const { data: profiles, error: prErr } = await supabase
    .from('crop_profiles')
    .select('id, stage_timeline')
    .in('id', profileIds);
  if (prErr) return jsonResponse({ error: prErr.message }, 500);

  const profileMap = new Map<string, CropProfileRow>();
  for (const p of (profiles ?? []) as CropProfileRow[]) profileMap.set(p.id, p);

  const rowsToInsert: Array<Record<string, unknown>> = [];
  for (const plan of (plans ?? []) as CropPlanRow[]) {
    const profile = profileMap.get(plan.crop_profile_id);
    if (!profile?.stage_timeline) continue;
    const anchor = plan.actual_sowing_date ?? plan.planned_sowing_date;
    if (!anchor) continue;
    const anchorDate = new Date(anchor);
    for (const target of targetDates) {
      const targetDate = new Date(target + 'T00:00:00Z');
      const daysSinceSowing = Math.floor((targetDate.getTime() - anchorDate.getTime()) / 86_400_000);
      for (const entry of profile.stage_timeline) {
        if (entry.dayOffset === daysSinceSowing) {
          rowsToInsert.push({
            entity_id: plan.entity_id,
            field_id: plan.field_id,
            crop_plan_id: plan.id,
            title: entry.title,
            title_ur: entry.titleUr ?? null,
            task_kind: entry.taskKind,
            scheduled_for: target,
            estimated_hours: entry.estimatedHours ?? null,
            status: 'open',
          });
        }
      }
    }
  }

  if (rowsToInsert.length === 0) return jsonResponse({ generated: 0 });

  const { error: insErr, count } = await supabase
    .from('tasks')
    .insert(rowsToInsert, { count: 'exact' });
  if (insErr) return jsonResponse({ error: insErr.message }, 500);

  return jsonResponse({ generated: count ?? rowsToInsert.length });
}));
