// weather-puller
// Schedule: pg_cron every 3 hours.
// For every entity with at least one farm centroid, fetches a forecast and
// upserts a weather_records row keyed on (entity_id, recorded_for).
// Provider is selected via WEATHER_PROVIDER env var: 'openweather' (default) or 'pmd'.

import { getServiceClient, jsonResponse, pktTodayIso } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
interface FarmRow {
  entity_id: string;
  centroid: { lat: number; lng: number } | null;
}

async function fetchOpenWeather(lat: number, lng: number) {
  const key = Deno.env.get('OPENWEATHER_API_KEY');
  if (!key) throw new Error('OPENWEATHER_API_KEY missing');
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather ${res.status}`);
  return res.json();
}

interface OpenWeatherEntry {
  main?: { temp_min?: number; temp_max?: number; humidity?: number };
  wind?: { speed?: number };
  rain?: { '3h'?: number };
}

interface OpenWeatherPayload {
  list?: OpenWeatherEntry[];
}

Deno.serve(instrument('weather-puller', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();
  const provider = Deno.env.get('WEATHER_PROVIDER') ?? 'openweather';

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

  let upserts = 0;
  for (const t of targets) {
    try {
      const data = provider === 'openweather'
        ? (await fetchOpenWeather(t.lat, t.lng)) as OpenWeatherPayload
        : { list: [] } as OpenWeatherPayload;
      const sample = (data.list ?? [])[0];
      const minTemp = sample?.main?.temp_min ?? null;
      const maxTemp = sample?.main?.temp_max ?? null;
      const humidity = sample?.main?.humidity ?? null;
      const wind = sample?.wind?.speed ? sample.wind.speed * 3.6 : null;
      const rain = sample?.rain?.['3h'] ?? 0;

      const { error: upErr } = await supabase.from('weather_records').upsert(
        {
          entity_id: t.entityId,
          recorded_for: today,
          source: provider,
          min_temp_c: minTemp,
          max_temp_c: maxTemp,
          rainfall_mm: rain,
          humidity_pct: humidity,
          wind_kph: wind,
          forecast_payload: data,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'entity_id,recorded_for' },
      );
      if (!upErr) upserts += 1;
    } catch (err) {
      console.error(`weather pull failed for ${t.entityId}:`, err);
    }
  }

  return jsonResponse({ upserts, provider, targets: targets.length });
}));
