// air-quality-poller
// Schedule: pg_cron hourly between 06:00 and 20:00 PKT.
// For each entity with at least one farm centroid, fetches the nearest OpenAQ
// station, inserts a reading, and dispatches a smog notification when the
// AQI crosses the very_unhealthy threshold (>= 200).

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface FarmRow {
  entity_id: string;
  centroid: { lat: number; lng: number } | null;
}

interface ReadingPayload {
  station_name: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  co: number | null;
  aqi: number | null;
  level: string;
}

const OPENAQ_BASE = 'https://api.openaq.org/v2';

const PM25_BREAKS: Array<[number, number, number, number]> = [
  [0, 12, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 500.4, 301, 500],
];

const PM10_BREAKS: Array<[number, number, number, number]> = [
  [0, 54, 0, 50],
  [55, 154, 51, 100],
  [155, 254, 101, 150],
  [255, 354, 151, 200],
  [355, 424, 201, 300],
  [425, 604, 301, 500],
];

function aqiFromBreakpoints(c: number, table: Array<[number, number, number, number]>): number | null {
  for (const [cLo, cHi, iLo, iHi] of table) {
    if (c >= cLo && c <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo);
    }
  }
  return null;
}

function levelForAqi(aqi: number): string {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy_sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very_unhealthy';
  return 'hazardous';
}

interface OpenAQMeasurement {
  location?: string;
  parameter?: string;
  value?: number;
  date?: { utc?: string };
}

async function fetchReading(lat: number, lng: number): Promise<ReadingPayload | null> {
  const params = new URLSearchParams();
  params.set('coordinates', `${lat},${lng}`);
  params.set('radius', '25000');
  params.set('limit', '50');
  params.set('order_by', 'datetime');
  params.set('sort', 'desc');
  for (const p of ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co']) {
    params.append('parameter', p);
  }
  const res = await fetch(`${OPENAQ_BASE}/measurements?${params.toString()}`);
  if (!res.ok) return null;
  const json = await res.json() as { results?: OpenAQMeasurement[] };
  const measurements = json.results ?? [];
  if (measurements.length === 0) return null;

  type Bucket = { name: string; latest: number; params: Record<string, { value: number; date: number }> };
  const stations = new Map<string, Bucket>();
  for (const m of measurements) {
    const name = m.location ?? 'unknown';
    const param = m.parameter;
    if (!param || typeof m.value !== 'number') continue;
    const dateMs = m.date?.utc ? Date.parse(m.date.utc) : 0;
    let s = stations.get(name);
    if (!s) {
      s = { name, latest: 0, params: {} };
      stations.set(name, s);
    }
    if (dateMs > s.latest) s.latest = dateMs;
    const existing = s.params[param];
    if (!existing || dateMs > existing.date) {
      s.params[param] = { value: m.value, date: dateMs };
    }
  }
  let best: Bucket | null = null;
  for (const s of stations.values()) {
    if (!best || s.latest > best.latest) best = s;
  }
  if (!best) return null;

  const pm25 = best.params.pm25?.value ?? null;
  const pm10 = best.params.pm10?.value ?? null;
  const a = pm25 !== null ? aqiFromBreakpoints(pm25, PM25_BREAKS) : null;
  const b = pm10 !== null ? aqiFromBreakpoints(pm10, PM10_BREAKS) : null;
  let aqi: number | null = null;
  if (a !== null || b !== null) aqi = Math.max(a ?? 0, b ?? 0);

  return {
    station_name: best.name,
    pm25,
    pm10,
    no2: best.params.no2?.value ?? null,
    o3: best.params.o3?.value ?? null,
    so2: best.params.so2?.value ?? null,
    co: best.params.co?.value ?? null,
    aqi,
    level: aqi !== null ? levelForAqi(aqi) : 'moderate',
  };
}

Deno.serve(instrument('air-quality-poller', async () => {
  const supabase = getServiceClient();

  const { data: farms, error } = await supabase
    .from('farms')
    .select('entity_id, centroid');
  if (error) return jsonResponse({ error: error.message }, 500);

  const seen = new Set<string>();
  const targets: Array<{ entityId: string; lat: number; lng: number }> = [];
  for (const f of (farms ?? []) as FarmRow[]) {
    if (seen.has(f.entity_id)) continue;
    if (!f.centroid?.lat || !f.centroid?.lng) continue;
    seen.add(f.entity_id);
    targets.push({ entityId: f.entity_id, lat: f.centroid.lat, lng: f.centroid.lng });
  }

  let inserted = 0;
  let alerted = 0;
  for (const t of targets) {
    try {
      const reading = await fetchReading(t.lat, t.lng);
      if (!reading) continue;
      const { error: insErr } = await supabase.from('air_quality_readings').insert({
        entity_id: t.entityId,
        station_name: reading.station_name,
        pm25: reading.pm25,
        pm10: reading.pm10,
        no2: reading.no2,
        o3: reading.o3,
        so2: reading.so2,
        co: reading.co,
        aqi: reading.aqi,
        level: reading.level,
      });
      if (insErr) continue;
      inserted++;

      if (reading.aqi !== null && reading.aqi >= 200) {
        // Notify directors/supervisors for this entity. Title is bilingual-friendly.
        const { data: recipients } = await supabase
          .from('user_entity_roles')
          .select('user_id')
          .eq('entity_id', t.entityId)
          .in('role', ['director', 'supervisor']);
        for (const r of (recipients ?? []) as Array<{ user_id: string }>) {
          await supabase.from('notifications').insert({
            recipient_id: r.user_id,
            entity_id: t.entityId,
            channel: 'inapp',
            category: 'air_quality',
            title: `Smog level ${reading.aqi} today`,
            body: `Air quality at ${reading.station_name} is ${reading.level}. Postpone outdoor spraying and provide masks to field workers.`,
            body_ur: `${reading.station_name} پر ہوا کی کیفیت خطرناک ہے۔ بیرونی سپرے ملتوی کریں۔`,
          });
          alerted++;
        }
      }
    } catch {
      // continue
    }
  }

  return jsonResponse({ inserted, alerted, recordsProcessed: inserted });
}));
