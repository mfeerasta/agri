// irrigation-scheduler
// Schedule: pg_cron at 04:00 PKT daily.
// For each active crop plan: if soil moisture < crop threshold AND no rain forecast in next 48h
// AND a Warabandi slot is available within 3 days, auto-create irrigation_schedules + queue notification.
// Also marks any 'planned' schedules past due (no logged event) as 'missed' and notifies supervisor.

import { getServiceClient, jsonResponse, pktTodayIso } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const CROP_MOISTURE_THRESHOLDS: Record<string, number> = {
  wheat: 0.20,
  maize: 0.22,
  cotton: 0.18,
  rice: 0.30,
  sugarcane: 0.22,
  default: 0.20,
};

function thresholdFor(crop: string | null | undefined): number {
  if (!crop) return CROP_MOISTURE_THRESHOLDS.default;
  return CROP_MOISTURE_THRESHOLDS[crop.toLowerCase()] ?? CROP_MOISTURE_THRESHOLDS.default;
}

interface CropPlanRow {
  id: string;
  entity_id: string;
  field_id: string;
  crop_name: string | null;
}

interface SlotRow {
  id: string;
  water_source_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number | null;
  water_sources: { farm_id: string } | null;
}

interface FieldRow {
  id: string;
  block_id: string;
  blocks: { farm_id: string; farms: { entity_id: string } } | null;
}

function nextOccurrence(dayOfWeek: number, startTime: string, from: Date): Date {
  const today = from.getDay();
  let diff = (dayOfWeek - today + 7) % 7;
  const d = new Date(from);
  d.setDate(from.getDate() + diff);
  const [hh = '0', mm = '0'] = startTime.split(':');
  d.setHours(Number(hh), Number(mm), 0, 0);
  if (d <= from) d.setDate(d.getDate() + 7);
  return d;
}

Deno.serve(instrument('irrigation-scheduler', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();
  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Mark missed slots first
  const { data: missed } = await supabase
    .from('irrigation_schedules')
    .update({ status: 'missed' })
    .eq('status', 'planned')
    .lt('scheduled_for', now.toISOString())
    .is('completed_event_id', null)
    .select('id, field_id');
  const missedCount = missed?.length ?? 0;

  // Active crop plans
  const { data: plans, error: planErr } = await supabase
    .from('crop_plans')
    .select('id, entity_id, field_id, crop_name')
    .eq('status', 'active');
  if (planErr) return jsonResponse({ error: planErr.message }, 500);

  // Field -> farm mapping (for Warabandi slot lookup)
  const { data: fields } = await supabase
    .from('fields')
    .select('id, block_id, blocks(farm_id, farms(entity_id))');
  const fieldFarm = new Map<string, string>();
  for (const f of (fields ?? []) as unknown as FieldRow[]) {
    if (f.blocks?.farm_id) fieldFarm.set(f.id, f.blocks.farm_id);
  }

  // Active Warabandi slots
  const { data: slots } = await supabase
    .from('warabandi_slots')
    .select('id, water_source_id, day_of_week, start_time, duration_minutes, water_sources(farm_id)')
    .eq('is_active', true);
  const slotsByFarm = new Map<string, SlotRow[]>();
  for (const s of (slots ?? []) as unknown as SlotRow[]) {
    const farmId = s.water_sources?.farm_id;
    if (!farmId) continue;
    const arr = slotsByFarm.get(farmId) ?? [];
    arr.push(s);
    slotsByFarm.set(farmId, arr);
  }

  let createdCount = 0;
  for (const p of (plans ?? []) as CropPlanRow[]) {
    const threshold = thresholdFor(p.crop_name);

    // Latest soil moisture
    const { data: hourly } = await supabase
      .from('weather_hourly')
      .select('soil_moisture_0to10, rainfall_mm, forecast_time')
      .eq('entity_id', p.entity_id)
      .gte('forecast_time', now.toISOString())
      .lte('forecast_time', new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString())
      .order('forecast_time', { ascending: true })
      .limit(48);

    const currentMoisture = Number(hourly?.[0]?.soil_moisture_0to10 ?? 0);
    const rainNext48 = (hourly ?? []).reduce((acc, h) => acc + Number(h.rainfall_mm ?? 0), 0);
    if (currentMoisture >= threshold) continue;
    if (rainNext48 > 5) continue;

    const farmId = fieldFarm.get(p.field_id);
    if (!farmId) continue;
    const farmSlots = slotsByFarm.get(farmId) ?? [];

    // Pick earliest slot within 3 days
    let pickedSlot: SlotRow | null = null;
    let pickedAt: Date | null = null;
    for (const s of farmSlots) {
      const occ = nextOccurrence(s.day_of_week, s.start_time, now);
      if (occ <= horizon && (!pickedAt || occ < pickedAt)) {
        pickedSlot = s;
        pickedAt = occ;
      }
    }
    if (!pickedSlot || !pickedAt) continue;

    // Skip if there is already a planned schedule for this field within ±1h
    const winStart = new Date(pickedAt.getTime() - 60 * 60 * 1000).toISOString();
    const winEnd = new Date(pickedAt.getTime() + 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('irrigation_schedules')
      .select('id')
      .eq('field_id', p.field_id)
      .eq('status', 'planned')
      .gte('scheduled_for', winStart)
      .lte('scheduled_for', winEnd)
      .limit(1);
    if ((existing?.length ?? 0) > 0) continue;

    const { error: insErr } = await supabase.from('irrigation_schedules').insert({
      field_id: p.field_id,
      crop_plan_id: p.id,
      scheduled_for: pickedAt.toISOString(),
      warabandi_slot_id: pickedSlot.id,
      water_source_id: pickedSlot.water_source_id,
      expected_duration_minutes: pickedSlot.duration_minutes,
      status: 'planned',
      created_by_system: true,
    });
    if (insErr) continue;
    createdCount += 1;

    // Notify farm manager
    const { data: managers } = await supabase
      .from('user_entity_roles')
      .select('user_id')
      .eq('entity_id', p.entity_id)
      .eq('role', 'farm_manager')
      .eq('is_active', true);
    for (const m of managers ?? []) {
      await supabase.from('notifications').insert({
        recipient_id: m.user_id,
        entity_id: p.entity_id,
        channel: 'whatsapp',
        category: 'irrigation',
        title: `Auto-scheduled irrigation for ${p.crop_name ?? 'crop'} on ${pickedAt.toLocaleString()}`,
        body: `Soil moisture ${currentMoisture.toFixed(2)} below threshold ${threshold.toFixed(2)}. No rain forecast 48h.`,
        body_ur: `خود کار آبپاشی شیڈول`,
        payload: { fieldId: p.field_id, scheduledFor: pickedAt.toISOString(), slotId: pickedSlot.id },
      });
    }
  }

  // For each missed schedule, notify supervisor
  for (const ms of missed ?? []) {
    const { data: f } = await supabase
      .from('fields')
      .select('id, block_id, blocks(farm_id, farms(entity_id))')
      .eq('id', ms.field_id)
      .single();
    const entityId = (f as unknown as FieldRow)?.blocks?.farms?.entity_id;
    if (!entityId) continue;
    const { data: supervisors } = await supabase
      .from('user_entity_roles')
      .select('user_id')
      .eq('entity_id', entityId)
      .eq('role', 'supervisor')
      .eq('is_active', true);
    for (const sup of supervisors ?? []) {
      await supabase.from('notifications').insert({
        recipient_id: sup.user_id,
        entity_id: entityId,
        channel: 'whatsapp',
        category: 'irrigation',
        title: 'Missed irrigation slot',
        body: `Slot passed without a logged event (schedule ${ms.id}).`,
        body_ur: `آبپاشی کا وقت ضائع ہوگیا`,
        payload: { scheduleId: ms.id },
      });
    }
  }

  return jsonResponse({ today, missed: missedCount, scheduled: createdCount });
}));
