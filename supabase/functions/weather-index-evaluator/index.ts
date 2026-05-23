// weather-index-evaluator
// Schedule: pg_cron daily at 07:00 PKT.
// For every active weather_index_triggers row attached to an active policy,
// computes the measured value over the configured window, records a
// weather_index_evaluations row, and, if the threshold trips, auto creates a
// draft insurance_claims row + notifies the director.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface PolicyLite {
  id: string;
  entity_id: string;
  policy_number: string;
  insurer_name: string;
  effective_from: string;
  effective_to: string;
  status: string;
  fields_covered: string[] | null;
}

interface TriggerRow {
  id: string;
  policy_id: string;
  trigger_kind: string;
  threshold_value: string;
  measurement_window_days: number;
  payout_per_unit_pkr: string | null;
  max_payout_pkr: string | null;
  is_active: boolean;
}

interface WeatherHourlyRow {
  forecast_time: string;
  temp_c: string | null;
  rainfall_mm: string | null;
  wind_kph: string | null;
  soil_moisture_0to10: string | null;
}

interface ClimateNormalRow {
  doy: number;
  rainfall_mm: string | null;
}

interface NdviRow {
  ndvi: string | null;
  acquired_on: string;
}

interface LocustAlertRow {
  distance_km: string | null;
  observed_on: string;
}

function windowStart(today: string, days: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function dayOfYear(iso: string): number {
  const d = new Date(iso);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

async function computeMeasured(
  supabase: ReturnType<typeof getServiceClient>,
  trigger: TriggerRow,
  policy: PolicyLite,
  today: string,
): Promise<number> {
  const startDate = windowStart(today, trigger.measurement_window_days);
  const kind = trigger.trigger_kind;

  if (kind === 'frost_hours' || kind === 'heat_days' || kind === 'rainfall_excess' || kind === 'wind_speed' || kind === 'soil_moisture_below') {
    const { data } = await supabase
      .schema('zameen')
      .from('weather_hourly')
      .select('forecast_time, temp_c, rainfall_mm, wind_kph, soil_moisture_0to10')
      .eq('entity_id', policy.entity_id)
      .gte('forecast_time', `${startDate}T00:00:00Z`)
      .lte('forecast_time', `${today}T23:59:59Z`);
    const rows = (data ?? []) as WeatherHourlyRow[];
    if (kind === 'frost_hours') {
      return rows.filter((r) => Number(r.temp_c ?? 99) <= 2).length;
    }
    if (kind === 'heat_days') {
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const day = r.forecast_time.slice(0, 10);
        byDay.set(day, Math.max(byDay.get(day) ?? -99, Number(r.temp_c ?? -99)));
      }
      let count = 0;
      for (const t of byDay.values()) if (t >= 40) count += 1;
      return count;
    }
    if (kind === 'rainfall_excess') {
      return rows.reduce((s, r) => s + Number(r.rainfall_mm ?? 0), 0);
    }
    if (kind === 'wind_speed') {
      return rows.reduce((m, r) => Math.max(m, Number(r.wind_kph ?? 0)), 0);
    }
    // soil_moisture_below: report the minimum observation in window
    return rows.reduce((m, r) => Math.min(m, Number(r.soil_moisture_0to10 ?? 1)), 1);
  }

  if (kind === 'rainfall_deficit') {
    const { data: actuals } = await supabase
      .schema('zameen')
      .from('weather_hourly')
      .select('rainfall_mm, forecast_time')
      .eq('entity_id', policy.entity_id)
      .gte('forecast_time', `${startDate}T00:00:00Z`)
      .lte('forecast_time', `${today}T23:59:59Z`);
    const actual = (actuals ?? []).reduce((s: number, r: { rainfall_mm: string | null }) => s + Number(r.rainfall_mm ?? 0), 0);
    const startDoy = dayOfYear(startDate);
    const endDoy = dayOfYear(today);
    const { data: normals } = await supabase
      .schema('zameen')
      .from('climate_normals')
      .select('doy, rainfall_mm')
      .eq('entity_id', policy.entity_id)
      .gte('doy', startDoy)
      .lte('doy', endDoy);
    const expected = ((normals ?? []) as ClimateNormalRow[]).reduce((s, r) => s + Number(r.rainfall_mm ?? 0), 0);
    return Math.max(0, expected - actual);
  }

  if (kind === 'ndvi_below') {
    const fields = policy.fields_covered ?? [];
    if (fields.length === 0) return 1;
    const { data } = await supabase
      .schema('zameen')
      .from('ndvi_observations')
      .select('ndvi, acquired_on')
      .in('field_id', fields)
      .gte('acquired_on', startDate)
      .lte('acquired_on', today)
      .order('acquired_on', { ascending: false })
      .limit(20);
    const rows = ((data ?? []) as NdviRow[]).map((r) => Number(r.ndvi ?? 1)).filter((n) => Number.isFinite(n));
    if (rows.length === 0) return 1;
    return rows.reduce((s, n) => s + n, 0) / rows.length;
  }

  if (kind === 'locust_within_km') {
    const { data } = await supabase
      .schema('zameen')
      .from('locust_alerts')
      .select('distance_km, observed_on')
      .eq('entity_id', policy.entity_id)
      .gte('observed_on', startDate)
      .lte('observed_on', today)
      .order('distance_km', { ascending: true })
      .limit(1);
    const rows = (data ?? []) as LocustAlertRow[];
    if (rows.length === 0 || rows[0].distance_km === null) return 9999;
    return Number(rows[0].distance_km);
  }

  return 0;
}

function isTripped(kind: string, measured: number, threshold: number): boolean {
  // below-style triggers: tripped when measured < threshold
  if (kind === 'rainfall_deficit') return measured >= threshold;
  if (kind === 'ndvi_below' || kind === 'soil_moisture_below' || kind === 'locust_within_km') {
    return measured < threshold;
  }
  // above-style: frost_hours, heat_days, rainfall_excess, wind_speed
  return measured >= threshold;
}

function payoutFor(trigger: TriggerRow, measured: number): number {
  if (!trigger.payout_per_unit_pkr) return 0;
  const perUnit = Number(trigger.payout_per_unit_pkr);
  const threshold = Number(trigger.threshold_value);
  const excess = Math.max(0, Math.abs(measured - threshold));
  const raw = excess * perUnit;
  const cap = trigger.max_payout_pkr ? Number(trigger.max_payout_pkr) : Infinity;
  return Math.min(raw, cap);
}

function inferCause(kind: string): string {
  if (kind === 'frost_hours') return 'frost';
  if (kind === 'heat_days') return 'drought';
  if (kind === 'rainfall_deficit') return 'drought';
  if (kind === 'rainfall_excess') return 'flood';
  if (kind === 'wind_speed') return 'fire';
  if (kind === 'ndvi_below') return 'disease';
  if (kind === 'soil_moisture_below') return 'drought';
  if (kind === 'locust_within_km') return 'pest';
  return 'disease';
}

Deno.serve(instrument('weather-index-evaluator', async () => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: triggers, error: trigErr } = await supabase
    .schema('zameen')
    .from('weather_index_triggers')
    .select('id, policy_id, trigger_kind, threshold_value, measurement_window_days, payout_per_unit_pkr, max_payout_pkr, is_active')
    .eq('is_active', true);
  if (trigErr) return jsonResponse({ error: trigErr.message }, 500);

  let evaluated = 0;
  let tripped = 0;
  let drafted = 0;

  for (const t of ((triggers ?? []) as TriggerRow[])) {
    const { data: policyRows } = await supabase
      .schema('zameen')
      .from('insurance_policies')
      .select('id, entity_id, policy_number, insurer_name, effective_from, effective_to, status, fields_covered')
      .eq('id', t.policy_id)
      .eq('status', 'active')
      .lte('effective_from', today)
      .gte('effective_to', today)
      .limit(1);
    const policy = (policyRows ?? [])[0] as PolicyLite | undefined;
    if (!policy) continue;

    // skip if already evaluated today
    const { data: existing } = await supabase
      .schema('zameen')
      .from('weather_index_evaluations')
      .select('id')
      .eq('trigger_id', t.id)
      .eq('evaluated_on', today)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const measured = await computeMeasured(supabase, t, policy, today);
    const threshold = Number(t.threshold_value);
    const triggered = isTripped(t.trigger_kind, measured, threshold);
    const payout = triggered ? payoutFor(t, measured) : 0;

    let claimDraftId: string | null = null;
    if (triggered) {
      const { data: claim, error: claimErr } = await supabase
        .schema('zameen')
        .from('insurance_claims')
        .insert({
          policy_id: policy.id,
          incident_date: today,
          reported_date: today,
          cause: inferCause(t.trigger_kind),
          affected_field_ids: policy.fields_covered ?? [],
          estimated_loss_pkr: payout.toFixed(2),
          claimed_pkr: payout.toFixed(2),
          status: 'draft',
          notes: `Auto-drafted from weather index trigger ${t.trigger_kind}. Measured ${measured.toFixed(3)} vs threshold ${threshold.toFixed(3)} over ${t.measurement_window_days}d window.`,
          photo_urls: [],
        })
        .select('id')
        .single();
      if (!claimErr && claim) {
        claimDraftId = claim.id as string;
        drafted += 1;

        const { data: directors } = await supabase
          .from('user_entity_roles')
          .select('user_id')
          .eq('entity_id', policy.entity_id)
          .eq('role', 'director')
          .eq('is_active', true);
        for (const d of directors ?? []) {
          await supabase.schema('zameen').from('notifications').insert({
            recipient_id: d.user_id,
            entity_id: policy.entity_id,
            channel: 'in_app',
            category: 'weather_index_triggered',
            title: `Weather index tripped: ${t.trigger_kind}`,
            body: `${policy.insurer_name} policy ${policy.policy_number}. Measured ${measured.toFixed(2)} vs threshold ${threshold.toFixed(2)}. Draft claim created.`,
            deep_link: `/compliance/insurance/claims/${claimDraftId}`,
            payload: {
              policyId: policy.id,
              triggerId: t.id,
              claimDraftId,
              measured,
              threshold,
              payoutPkr: payout,
            },
          });
        }
      }
      tripped += 1;
    }

    await supabase
      .schema('zameen')
      .from('weather_index_evaluations')
      .insert({
        trigger_id: t.id,
        evaluated_on: today,
        measured_value: measured.toFixed(3),
        threshold_value: threshold.toFixed(3),
        is_triggered: triggered,
        computed_payout_pkr: triggered ? payout.toFixed(2) : null,
        claim_draft_id: claimDraftId,
      });
    evaluated += 1;
  }

  return jsonResponse({ evaluated, tripped, drafted, processed: evaluated });
}));
