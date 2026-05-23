// energy-anomaly-detector
// Daily: for each meter, compute mean + stddev over trailing 90 days of consumption.
// Flag latest reading if abs(consumption - mean) > 2 * stddev. Theft/leak signal.

import { getServiceClient, jsonResponse, pktTodayIso, pktAddDays } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface ReadingRow {
  id: string;
  meter_id: string;
  reading_date: string;
  consumption_kwh: string | null;
}

interface MeterRow {
  id: string;
  entity_id: string;
  meter_number: string;
  meter_kind: string;
}

Deno.serve(
  instrument('energy-anomaly-detector', async () => {
    const supabase = getServiceClient();
    const today = pktTodayIso();
    const windowStart = pktAddDays(today, -90);

    const { data: meters, error: mErr } = await supabase
      .from('energy_meters')
      .select('id, entity_id, meter_number, meter_kind')
      .eq('is_active', true);
    if (mErr) return jsonResponse({ error: mErr.message }, 500);

    let flagged = 0;
    for (const meter of (meters ?? []) as MeterRow[]) {
      const { data: readings } = await supabase
        .from('energy_readings')
        .select('id, meter_id, reading_date, consumption_kwh')
        .eq('meter_id', meter.id)
        .gte('reading_date', windowStart)
        .lte('reading_date', today)
        .order('reading_date', { ascending: false });

      const rows = (readings ?? []) as ReadingRow[];
      const values = rows
        .map((r) => Number(r.consumption_kwh ?? 0))
        .filter((v) => v > 0);
      if (values.length < 5) continue;

      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
      const stddev = Math.sqrt(variance);
      if (stddev <= 0) continue;

      const latest = rows[0];
      if (!latest || latest.consumption_kwh == null) continue;
      const latestVal = Number(latest.consumption_kwh);
      const z = Math.abs(latestVal - mean) / stddev;
      if (z > 2) {
        const direction = latestVal > mean ? 'spike' : 'drop';
        await supabase.from('platform_events').insert({
          entity_id: meter.entity_id,
          event_kind: 'energy_anomaly',
          severity: latestVal > mean * 1.5 ? 'high' : 'medium',
          payload: {
            meterId: meter.id,
            meterNumber: meter.meter_number,
            meterKind: meter.meter_kind,
            readingId: latest.id,
            readingDate: latest.reading_date,
            value: latestVal,
            baselineMean: Number(mean.toFixed(2)),
            stddev: Number(stddev.toFixed(2)),
            zScore: Number(z.toFixed(2)),
            direction,
          },
        });
        flagged += 1;
      }
    }

    return jsonResponse({ ok: true, flagged });
  }),
);
