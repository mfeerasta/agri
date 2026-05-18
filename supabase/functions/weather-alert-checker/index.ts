// weather-alert-checker
// Schedule: pg_cron at 04:30 UTC daily, after weather-puller at 04:00.
// For every entity with enabled rules, compares recent zameen.weather_records
// against rule thresholds. On match (and >=24h since last fire), inserts a
// zameen.weather_alerts row and executes the rule's action.

import { getServiceClient, jsonResponse, pktTodayIso } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

type ConditionKind =
  | 'frost_warning'
  | 'heatwave'
  | 'heavy_rain'
  | 'strong_wind'
  | 'low_humidity'
  | 'drought_days';

type ActionKind = 'create_task' | 'notify_supervisor' | 'flag_field' | 'suspend_spraying';

interface Threshold {
  minTempC?: number;
  maxTempC?: number;
  rainfallMm?: number;
  windKph?: number;
  humidityPct?: number;
  consecutiveDays?: number;
}

interface Rule {
  id: string;
  entity_id: string;
  name: string;
  condition_kind: ConditionKind;
  threshold: Threshold;
  action_kind: ActionKind;
  action_config: Record<string, unknown>;
  last_fired_at: string | null;
}

interface WeatherRow {
  recorded_for: string;
  min_temp_c: string | number | null;
  max_temp_c: string | number | null;
  rainfall_mm: string | number | null;
  humidity_pct: string | number | null;
  wind_kph: string | number | null;
}

function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const x = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(x) ? x : null;
}

function evaluate(rule: Rule, rows: WeatherRow[]): { matched: boolean; observation: Record<string, unknown> } {
  const t = rule.threshold;
  switch (rule.condition_kind) {
    case 'frost_warning': {
      const limit = t.minTempC ?? 2;
      const hit = rows.find((r) => {
        const v = n(r.min_temp_c);
        return v !== null && v <= limit;
      });
      return hit
        ? { matched: true, observation: { thresholdMinTempC: limit, observedMinTempC: n(hit.min_temp_c), on: hit.recorded_for } }
        : { matched: false, observation: {} };
    }
    case 'heatwave': {
      const limit = t.maxTempC ?? 40;
      const days = t.consecutiveDays ?? 3;
      let run = 0;
      let runStart: string | null = null;
      const sorted = [...rows].sort((a, b) => a.recorded_for.localeCompare(b.recorded_for));
      for (const r of sorted) {
        const v = n(r.max_temp_c);
        if (v !== null && v >= limit) {
          if (run === 0) runStart = r.recorded_for;
          run += 1;
          if (run >= days) {
            return { matched: true, observation: { thresholdMaxTempC: limit, days: run, since: runStart } };
          }
        } else {
          run = 0;
          runStart = null;
        }
      }
      return { matched: false, observation: {} };
    }
    case 'heavy_rain': {
      const limit = t.rainfallMm ?? 30;
      const hit = rows.find((r) => {
        const v = n(r.rainfall_mm);
        return v !== null && v >= limit;
      });
      return hit
        ? { matched: true, observation: { thresholdRainfallMm: limit, observedRainfallMm: n(hit.rainfall_mm), on: hit.recorded_for } }
        : { matched: false, observation: {} };
    }
    case 'strong_wind': {
      const limit = t.windKph ?? 25;
      const hit = rows.find((r) => {
        const v = n(r.wind_kph);
        return v !== null && v >= limit;
      });
      return hit
        ? { matched: true, observation: { thresholdWindKph: limit, observedWindKph: n(hit.wind_kph), on: hit.recorded_for } }
        : { matched: false, observation: {} };
    }
    case 'low_humidity': {
      const limit = t.humidityPct ?? 20;
      const hit = rows.find((r) => {
        const v = n(r.humidity_pct);
        return v !== null && v <= limit;
      });
      return hit
        ? { matched: true, observation: { thresholdHumidityPct: limit, observedHumidityPct: n(hit.humidity_pct), on: hit.recorded_for } }
        : { matched: false, observation: {} };
    }
    case 'drought_days': {
      const days = t.consecutiveDays ?? 21;
      const sorted = [...rows].sort((a, b) => a.recorded_for.localeCompare(b.recorded_for));
      let run = 0;
      for (const r of sorted) {
        const v = n(r.rainfall_mm);
        if (v !== null && v < 1) run += 1;
        else run = 0;
        if (run >= days) {
          return { matched: true, observation: { dryDays: run, requiredDays: days } };
        }
      }
      return { matched: false, observation: {} };
    }
  }
}

Deno.serve(instrument('weather-alert-checker', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();

  const { data: rules, error } = await supabase
    .from('weather_alert_rules')
    .select('id, entity_id, name, condition_kind, threshold, action_kind, action_config, last_fired_at')
    .eq('enabled', true);
  if (error) return jsonResponse({ error: error.message }, 500);

  const fromDate = new Date();
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  const fromIso = fromDate.toISOString().slice(0, 10);

  let fired = 0;
  let tasksCreated = 0;

  for (const rule of (rules ?? []) as Rule[]) {
    if (rule.last_fired_at) {
      const lastFired = new Date(rule.last_fired_at).getTime();
      if (Date.now() - lastFired < 24 * 60 * 60 * 1000) continue;
    }

    const { data: weather, error: wErr } = await supabase
      .from('weather_records')
      .select('recorded_for, min_temp_c, max_temp_c, rainfall_mm, humidity_pct, wind_kph')
      .eq('entity_id', rule.entity_id)
      .gte('recorded_for', fromIso)
      .order('recorded_for', { ascending: false });
    if (wErr || !weather || weather.length === 0) continue;

    const { matched, observation } = evaluate(rule, weather as WeatherRow[]);
    if (!matched) continue;

    let taskId: string | null = null;
    if (rule.action_kind === 'create_task') {
      const cfg = rule.action_config ?? {};
      const title = (cfg.title as string | undefined) ?? `Weather alert: ${rule.name}`;
      const taskKind = (cfg.taskKind as string | undefined) ?? 'irrigation';
      const { data: taskRow, error: tErr } = await supabase
        .from('tasks')
        .insert({
          entity_id: rule.entity_id,
          title,
          task_kind: taskKind,
          scheduled_for: today,
          priority: (cfg.priority as string | undefined) ?? 'high',
          description: `Auto-created by rule "${rule.name}". Observation: ${JSON.stringify(observation)}`,
        })
        .select('id')
        .single();
      if (!tErr && taskRow) {
        taskId = (taskRow as { id: string }).id;
        tasksCreated += 1;
      }
    } else if (rule.action_kind === 'notify_supervisor') {
      const { data: supervisors } = await supabase
        .from('user_entity_roles')
        .select('user_id')
        .eq('entity_id', rule.entity_id)
        .eq('role', 'supervisor')
        .eq('is_active', true);
      for (const sup of supervisors ?? []) {
        await supabase.from('notifications').insert({
          recipient_id: (sup as { user_id: string }).user_id,
          entity_id: rule.entity_id,
          channel: 'whatsapp',
          category: 'weather',
          title: `Weather alert: ${rule.name}`,
          body: JSON.stringify(observation),
        });
      }
    } else if (rule.action_kind === 'suspend_spraying') {
      // Flag entity-wide by inserting a notification only. UI reads recent
      // suspend_spraying alerts to gate spray scheduling.
      const { data: supervisors } = await supabase
        .from('user_entity_roles')
        .select('user_id')
        .eq('entity_id', rule.entity_id)
        .in('role', ['supervisor', 'director']);
      for (const sup of supervisors ?? []) {
        await supabase.from('notifications').insert({
          recipient_id: (sup as { user_id: string }).user_id,
          entity_id: rule.entity_id,
          channel: 'whatsapp',
          category: 'weather',
          title: `Spraying suspended: ${rule.name}`,
          body: JSON.stringify(observation),
        });
      }
    }
    // flag_field intentionally writes only the alert row; UI consumes it.

    const { error: aErr } = await supabase.from('weather_alerts').insert({
      rule_id: rule.id,
      entity_id: rule.entity_id,
      triggered_on: today,
      observation,
      task_id: taskId,
    });
    if (!aErr) {
      fired += 1;
      await supabase
        .from('weather_alert_rules')
        .update({ last_fired_at: new Date().toISOString(), fire_count: 0 })
        .eq('id', rule.id);
      // bump fire_count via raw rpc would be cleaner; do an inc through a second update.
      await supabase.rpc('increment_alert_rule_fire_count', { p_rule_id: rule.id }).then(() => undefined, () => undefined);
    }
  }

  return jsonResponse({ fired, tasksCreated, rules: (rules ?? []).length });
}));
