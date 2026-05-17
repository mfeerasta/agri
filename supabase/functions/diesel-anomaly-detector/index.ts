// diesel-anomaly-detector
// Schedule: pg_cron at 22:00 PKT.
// For each asset, compute rolling 30d avg L/hr from diesel_daily_logs.
// Flag any row >15% above the rolling avg into asset_logs and notify supervisors.

import { getServiceClient, jsonResponse, pktTodayIso, pktAddDays } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
const THRESHOLD_PCT = 15;

interface DailyLogRow {
  id: string;
  asset_id: string;
  entity_id: string;
  log_date: string;
  hours_run: string;
  diesel_filled_liters: string;
  anomaly_flag: string | null;
}

Deno.serve(instrument('diesel-anomaly-detector', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();
  const windowStart = pktAddDays(today, -30);

  const { data: logs, error } = await supabase
    .from('diesel_daily_logs')
    .select('id, asset_id, entity_id, log_date, hours_run, diesel_filled_liters, anomaly_flag')
    .gte('log_date', windowStart)
    .lte('log_date', today);
  if (error) return jsonResponse({ error: error.message }, 500);

  const byAsset = new Map<string, DailyLogRow[]>();
  for (const r of (logs ?? []) as DailyLogRow[]) {
    if (!byAsset.has(r.asset_id)) byAsset.set(r.asset_id, []);
    byAsset.get(r.asset_id)!.push(r);
  }

  let flagged = 0;
  for (const [assetId, rows] of byAsset.entries()) {
    const historical = rows.filter((r) => r.log_date < today);
    const totalHours = historical.reduce((s, r) => s + Number(r.hours_run), 0);
    const totalLitres = historical.reduce((s, r) => s + Number(r.diesel_filled_liters), 0);
    if (totalHours <= 0) continue;
    const baselineLph = totalLitres / totalHours;
    await supabase
      .from('assets')
      .update({ rolling_30d_avg_lph: baselineLph.toFixed(2) })
      .eq('id', assetId);

    const todays = rows.filter((r) => r.log_date === today);
    for (const r of todays) {
      const hrs = Number(r.hours_run);
      const ltr = Number(r.diesel_filled_liters);
      if (hrs <= 0) continue;
      const lph = ltr / hrs;
      const overPct = ((lph - baselineLph) / baselineLph) * 100;
      if (overPct > THRESHOLD_PCT) {
        const severity = overPct > 50 ? 'critical' : overPct > 25 ? 'high' : 'warning';
        await supabase
          .from('diesel_daily_logs')
          .update({ anomaly_flag: `high_burn:${overPct.toFixed(1)}pct` })
          .eq('id', r.id);
        await supabase.from('asset_logs').insert({
          asset_id: assetId,
          event_type: 'fuel_anomaly',
          details: {
            log_id: r.id,
            log_date: r.log_date,
            baseline_lph: Number(baselineLph.toFixed(2)),
            observed_lph: Number(lph.toFixed(2)),
            over_pct: Number(overPct.toFixed(1)),
            severity,
          },
        });
        await supabase.from('diesel_anomalies').insert({
          entity_id: r.entity_id,
          asset_id: assetId,
          diesel_daily_log_id: r.id,
          detected_on: r.log_date,
          rolling_30d_avg_lph: Number(baselineLph.toFixed(3)),
          observed_lph: Number(lph.toFixed(3)),
          deviation_pct: Number(overPct.toFixed(2)),
          severity,
          status: 'open',
        });
        const { data: managers } = await supabase
          .from('user_entity_roles')
          .select('user_id')
          .eq('entity_id', r.entity_id)
          .in('role', ['farm_manager', 'director'])
          .eq('is_active', true);
        for (const m of managers ?? []) {
          await supabase.from('notifications').insert({
            recipient_id: m.user_id,
            entity_id: r.entity_id,
            channel: 'whatsapp',
            category: 'diesel_anomaly',
            title: `Diesel anomaly: ${lph.toFixed(1)} L/h vs ${baselineLph.toFixed(1)} baseline`,
            body: `Asset ${assetId} burned +${overPct.toFixed(1)}% above 30d average today.`,
            payload: { assetId, logId: r.id, overPct },
          });
        }
        flagged += 1;
      }
    }
  }

  return jsonResponse({ flagged });
}));
