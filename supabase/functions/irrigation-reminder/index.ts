// irrigation-reminder
// Schedule: pg_cron at 06:00 PKT.
// Joins crop_plans -> fields -> blocks -> farms -> water_sources.schedule and
// recent weather_records to decide whether supervisors should be notified about
// today's irrigation slot.

import { getServiceClient, jsonResponse, pktTodayIso } from '../_shared/supabase.ts';

interface WaterScheduleEntry {
  fieldCode?: string;
  weekday?: number;
  startHour?: number;
  durationHours?: number;
}

interface WaterSourceRow {
  id: string;
  farm_id: string;
  identifier: string | null;
  schedule: WaterScheduleEntry[] | null;
}

interface FieldRow {
  id: string;
  code: string;
  block_id: string;
  blocks: { farm_id: string; farms: { entity_id: string } } | null;
}

Deno.serve(async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();
  const weekday = new Date(today + 'T00:00:00Z').getUTCDay();

  const { data: sources, error: srcErr } = await supabase
    .from('water_sources')
    .select('id, farm_id, identifier, schedule');
  if (srcErr) return jsonResponse({ error: srcErr.message }, 500);

  const slotsToday: Array<{ farmId: string; fieldCode: string; sourceId: string; durationHours: number }> = [];
  for (const s of (sources ?? []) as WaterSourceRow[]) {
    if (!Array.isArray(s.schedule)) continue;
    for (const slot of s.schedule) {
      if (slot.weekday === weekday && slot.fieldCode) {
        slotsToday.push({
          farmId: s.farm_id,
          fieldCode: slot.fieldCode,
          sourceId: s.id,
          durationHours: slot.durationHours ?? 1,
        });
      }
    }
  }
  if (slotsToday.length === 0) return jsonResponse({ notified: 0 });

  const { data: fields, error: fErr } = await supabase
    .from('fields')
    .select('id, code, block_id, blocks(farm_id, farms(entity_id))');
  if (fErr) return jsonResponse({ error: fErr.message }, 500);

  const fieldsByFarmAndCode = new Map<string, FieldRow>();
  for (const f of (fields ?? []) as unknown as FieldRow[]) {
    const farmId = f.blocks?.farm_id;
    if (farmId) fieldsByFarmAndCode.set(`${farmId}:${f.code}`, f);
  }

  let notified = 0;
  for (const slot of slotsToday) {
    const field = fieldsByFarmAndCode.get(`${slot.farmId}:${slot.fieldCode}`);
    if (!field) continue;
    const entityId = field.blocks?.farms?.entity_id;
    if (!entityId) continue;

    const { data: recentRain } = await supabase
      .from('weather_records')
      .select('rainfall_mm, recorded_for')
      .eq('entity_id', entityId)
      .gte('recorded_for', today)
      .limit(1);
    const rainfall = Number(recentRain?.[0]?.rainfall_mm ?? 0);
    const skipDueToRain = rainfall > 10;

    const { data: supervisors } = await supabase
      .from('user_entity_roles')
      .select('user_id')
      .eq('entity_id', entityId)
      .eq('role', 'supervisor')
      .eq('is_active', true);

    for (const sup of supervisors ?? []) {
      const { error: nErr } = await supabase.from('notifications').insert({
        recipient_id: sup.user_id,
        entity_id: entityId,
        channel: 'whatsapp',
        category: 'irrigation',
        title: skipDueToRain
          ? `Skip irrigation today (${slot.fieldCode}): ${rainfall}mm rain forecast`
          : `Irrigation due: ${slot.fieldCode} ~ ${slot.durationHours}h`,
        body: `Tubewell ${slot.sourceId} scheduled for ${slot.fieldCode} today.`,
        body_ur: `آج آبپاشی: ${slot.fieldCode}`,
        payload: { fieldId: field.id, sourceId: slot.sourceId, skipDueToRain, rainfallMm: rainfall },
      });
      if (!nErr) notified += 1;
    }
  }

  return jsonResponse({ notified, slots: slotsToday.length });
});
