// weather-puller
// Schedule: pg_cron every 3 hours.
// Fetches Open-Meteo daily + hourly forecast (16d) and short historical window
// for every entity with a farm centroid. No API keys required. Once per
// quarter, refreshes 40-year climate normals from NASA POWER.

import { getServiceClient, jsonResponse, pktTodayIso } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface FarmRow {
  entity_id: string;
  centroid: { lat: number; lng: number } | null;
}

interface CropPlanRow {
  entity_id: string;
  crop_name: string | null;
}

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const REQUEST_TIMEOUT_MS = 30_000;

const DAILY_PARAMS = [
  'temperature_2m_min',
  'temperature_2m_max',
  'temperature_2m_mean',
  'precipitation_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'surface_pressure_mean',
  'cloud_cover_mean',
  'relative_humidity_2m_mean',
  'et0_fao_evapotranspiration',
  'uv_index_max',
  'sunrise',
  'sunset',
  'daylight_duration',
  'soil_temperature_0_to_7cm_mean',
  'soil_moisture_0_to_10cm_mean',
  'soil_moisture_10_to_40cm_mean',
  'soil_moisture_40_to_100cm_mean',
].join(',');

const HOURLY_PARAMS = [
  'temperature_2m',
  'precipitation',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_gusts_10m',
  'uv_index',
  'cloud_cover',
  'soil_moisture_0_to_1cm',
].join(',');

const CROP_BASE_TEMP_C: Record<string, number> = {
  wheat: 5,
  barley: 5,
  maize: 10,
  rice: 10,
  cotton: 15,
  sugarcane: 12,
  tomato: 10,
  potato: 7,
};

interface OpenMeteoApiResponse {
  daily?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
}

interface PowerApiResponse {
  properties?: { parameter?: Record<string, Record<string, number>> };
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return 0;
}

function optNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

async function fetchJsonWithRetry<T>(url: string): Promise<T> {
  const attempt = async (): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`http ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await attempt();
  } catch (err) {
    return await attempt().catch((retryErr) => {
      throw new Error(`fetch failed: ${(err as Error).message} / ${(retryErr as Error).message}`);
    });
  }
}

function baseTempForCrop(name: string | null | undefined): number {
  if (!name) return 10;
  return CROP_BASE_TEMP_C[name.trim().toLowerCase()] ?? 10;
}

function countFrostHours(hourlyTimes: string[], hourlyTemps: (number | null)[], dateIso: string): number {
  let count = 0;
  for (let i = 0; i < hourlyTimes.length; i += 1) {
    if (!hourlyTimes[i].startsWith(dateIso)) continue;
    const t = hourlyTemps[i];
    if (typeof t === 'number' && t < 2) count += 1;
  }
  return count;
}

function countLeafWetnessHours(
  hourlyTimes: string[],
  rh: (number | null)[],
  rain: (number | null)[],
  dateIso: string,
): number {
  const idxs: number[] = [];
  for (let i = 0; i < hourlyTimes.length; i += 1) {
    if (hourlyTimes[i].startsWith(dateIso)) idxs.push(i);
  }
  let count = 0;
  for (const i of idxs) {
    if ((rh[i] ?? 0) <= 90) continue;
    const lo = Math.max(0, i - 12);
    const hi = Math.min(hourlyTimes.length - 1, i + 12);
    let rainNearby = false;
    for (let j = lo; j <= hi; j += 1) {
      if ((rain[j] ?? 0) > 0.1) { rainNearby = true; break; }
    }
    if (rainNearby) count += 1;
  }
  return count;
}

async function fetchOpenMeteo(lat: number, lng: number): Promise<OpenMeteoApiResponse> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: 'Asia/Karachi',
    forecast_days: '16',
    past_days: '7',
    daily: DAILY_PARAMS,
    hourly: HOURLY_PARAMS,
    wind_speed_unit: 'kmh',
  });
  return fetchJsonWithRetry<OpenMeteoApiResponse>(`${OPEN_METEO_FORECAST}?${params.toString()}`);
}

async function refreshClimateNormals(
  supabase: ReturnType<typeof getServiceClient>,
  entityId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const startYear = 1984;
  const endYear = 2024;
  const params = new URLSearchParams({
    parameters: 'T2M,PRECTOTCORR,EVPTRNS',
    community: 'AG',
    latitude: String(lat),
    longitude: String(lng),
    start: `${startYear}0101`,
    end: `${endYear}1231`,
    format: 'JSON',
  });
  const data = await fetchJsonWithRetry<PowerApiResponse>(`${POWER_URL}?${params.toString()}`);
  const p = data.properties?.parameter ?? {};
  const tMean = p.T2M ?? {};
  const rain = p.PRECTOTCORR ?? {};
  const et0 = p.EVPTRNS ?? {};

  const tempSums = new Array<number>(12).fill(0);
  const tempCounts = new Array<number>(12).fill(0);
  const rainByYearMonth = new Map<string, number>();
  const et0ByYearMonth = new Map<string, number>();

  for (const dateKey of Object.keys(tMean)) {
    const month = Number(dateKey.slice(4, 6)) - 1;
    const year = dateKey.slice(0, 4);
    const t = tMean[dateKey];
    if (t !== -999 && Number.isFinite(t)) {
      tempSums[month] += t;
      tempCounts[month] += 1;
    }
    const r = rain[dateKey] ?? 0;
    if (r !== -999) {
      const k = `${year}-${month}`;
      rainByYearMonth.set(k, (rainByYearMonth.get(k) ?? 0) + r);
    }
    const e = et0[dateKey] ?? 0;
    if (e !== -999) {
      const k = `${year}-${month}`;
      et0ByYearMonth.set(k, (et0ByYearMonth.get(k) ?? 0) + e);
    }
  }

  const monthlyMeanTempC = tempSums.map((s, i) => (tempCounts[i] > 0 ? s / tempCounts[i] : 0));
  const rainBuckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const [k, v] of rainByYearMonth.entries()) {
    rainBuckets[Number(k.split('-')[1])].push(v);
  }
  const et0Buckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const [k, v] of et0ByYearMonth.entries()) {
    et0Buckets[Number(k.split('-')[1])].push(v);
  }
  const monthlyTotalRainMm = rainBuckets.map((arr) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length,
  );
  const monthlyEt0Mm = et0Buckets.map((arr) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length,
  );

  await supabase.from('climate_normals').upsert(
    {
      entity_id: entityId,
      start_year: startYear,
      end_year: endYear,
      monthly_mean_temp_c: monthlyMeanTempC,
      monthly_total_rain_mm: monthlyTotalRainMm,
      monthly_et0_mm: monthlyEt0Mm,
      computed_at: new Date().toISOString(),
      source: 'nasa-power',
    },
    { onConflict: 'entity_id,source' },
  );
}

Deno.serve(instrument('weather-puller', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();

  const { data: farms, error } = await supabase
    .from('farms')
    .select('entity_id, centroid');
  if (error) return jsonResponse({ error: error.message }, 500);

  const { data: cropPlans } = await supabase
    .from('crop_plans')
    .select('entity_id, crop_name')
    .eq('status', 'active');
  const cropByEntity = new Map<string, string>();
  for (const cp of (cropPlans ?? []) as CropPlanRow[]) {
    if (cp.crop_name && !cropByEntity.has(cp.entity_id)) {
      cropByEntity.set(cp.entity_id, cp.crop_name);
    }
  }

  const seen = new Set<string>();
  const targets: Array<{ entityId: string; lat: number; lng: number }> = [];
  for (const f of (farms ?? []) as FarmRow[]) {
    if (seen.has(f.entity_id)) continue;
    if (!f.centroid?.lat || !f.centroid?.lng) continue;
    seen.add(f.entity_id);
    targets.push({ entityId: f.entity_id, lat: f.centroid.lat, lng: f.centroid.lng });
  }

  let dailyUpserts = 0;
  let hourlyUpserts = 0;
  let normalsRefreshed = 0;

  // Refresh normals once per quarter (entity-level): check computed_at.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  for (const t of targets) {
    try {
      const payload = await fetchOpenMeteo(t.lat, t.lng);
      const daily = payload.daily ?? {};
      const hourly = payload.hourly ?? {};

      const dailyTimes = (daily.time as string[] | undefined) ?? [];
      const minT = (daily.temperature_2m_min as (number | null)[] | undefined) ?? [];
      const maxT = (daily.temperature_2m_max as (number | null)[] | undefined) ?? [];
      const meanT = (daily.temperature_2m_mean as (number | null)[] | undefined) ?? [];
      const rainSum = (daily.precipitation_sum as (number | null)[] | undefined) ?? [];
      const rhMean = (daily.relative_humidity_2m_mean as (number | null)[] | undefined) ?? [];
      const wind = (daily.wind_speed_10m_max as (number | null)[] | undefined) ?? [];
      const gusts = (daily.wind_gusts_10m_max as (number | null)[] | undefined) ?? [];
      const et0 = (daily.et0_fao_evapotranspiration as (number | null)[] | undefined) ?? [];
      const uvMax = (daily.uv_index_max as (number | null)[] | undefined) ?? [];
      const sm0to10 = (daily.soil_moisture_0_to_10cm_mean as (number | null)[] | undefined) ?? [];
      const sm10to40 = (daily.soil_moisture_10_to_40cm_mean as (number | null)[] | undefined) ?? [];

      const hourlyTimes = (hourly.time as string[] | undefined) ?? [];
      const hTemp = (hourly.temperature_2m as (number | null)[] | undefined) ?? [];
      const hRain = (hourly.precipitation as (number | null)[] | undefined) ?? [];
      const hRh = (hourly.relative_humidity_2m as (number | null)[] | undefined) ?? [];
      const hWind = (hourly.wind_speed_10m as (number | null)[] | undefined) ?? [];
      const hGust = (hourly.wind_gusts_10m as (number | null)[] | undefined) ?? [];
      const hUv = (hourly.uv_index as (number | null)[] | undefined) ?? [];
      const hCloud = (hourly.cloud_cover as (number | null)[] | undefined) ?? [];
      const hSoil = (hourly.soil_moisture_0_to_1cm as (number | null)[] | undefined) ?? [];

      const baseTempC = baseTempForCrop(cropByEntity.get(t.entityId));
      let gddRunning = 0;

      const dailyRows = dailyTimes.map((date, i) => {
        const minC = num(minT[i]);
        const maxC = num(maxT[i]);
        const meanC = num(meanT[i] ?? (minC + maxC) / 2);
        const deltaGdd = Math.max(0, (minC + maxC) / 2 - baseTempC);
        gddRunning += deltaGdd;
        return {
          entity_id: t.entityId,
          recorded_for: date,
          source: 'open-meteo',
          data_source: 'open-meteo',
          min_temp_c: minC,
          max_temp_c: maxC,
          rainfall_mm: num(rainSum[i]),
          humidity_pct: num(rhMean[i]),
          wind_kph: num(wind[i]),
          wind_gust_kph: num(gusts[i]),
          uv_index_max: num(uvMax[i]),
          et0_mm: num(et0[i]),
          gdd_accumulated: Number(gddRunning.toFixed(2)),
          soil_moisture_0to10: optNum(sm0to10[i]),
          soil_moisture_10to40: optNum(sm10to40[i]),
          frost_hours: countFrostHours(hourlyTimes, hTemp, date),
          leaf_wetness_hours: countLeafWetnessHours(hourlyTimes, hRh, hRain, date),
          forecast_payload: { meanTempC: meanC },
          fetched_at: new Date().toISOString(),
        };
      });

      for (const row of dailyRows) {
        const { error: upErr } = await supabase
          .from('weather_records')
          .upsert(row, { onConflict: 'entity_id,recorded_for' });
        if (!upErr) dailyUpserts += 1;
      }

      const hourlyRows = hourlyTimes.map((time, i) => ({
        entity_id: t.entityId,
        forecast_time: time,
        fetched_at: new Date().toISOString(),
        temp_c: optNum(hTemp[i]),
        rainfall_mm: optNum(hRain[i]),
        humidity_pct: optNum(hRh[i]),
        wind_kph: optNum(hWind[i]),
        wind_gust_kph: optNum(hGust[i]),
        uv_index: optNum(hUv[i]),
        cloud_cover_pct: optNum(hCloud[i]),
        soil_moisture_0to10: optNum(hSoil[i]),
        source: 'open-meteo',
      }));

      // Batch upserts in groups of 200 to avoid payload limits.
      for (let i = 0; i < hourlyRows.length; i += 200) {
        const batch = hourlyRows.slice(i, i + 200);
        const { error: hErr } = await supabase
          .from('weather_hourly')
          .upsert(batch, { onConflict: 'entity_id,forecast_time,source' });
        if (!hErr) hourlyUpserts += batch.length;
      }

      // Refresh climate normals if older than 90 days (or absent).
      const { data: existingNormals } = await supabase
        .from('climate_normals')
        .select('computed_at')
        .eq('entity_id', t.entityId)
        .eq('source', 'nasa-power')
        .maybeSingle();
      const lastComputed = (existingNormals as { computed_at: string } | null)?.computed_at;
      if (!lastComputed || lastComputed < ninetyDaysAgo) {
        try {
          await refreshClimateNormals(supabase, t.entityId, t.lat, t.lng);
          normalsRefreshed += 1;
        } catch (err) {
          console.error(`climate normals refresh failed for ${t.entityId}:`, err);
        }
      }
    } catch (err) {
      console.error(`weather pull failed for ${t.entityId}:`, err);
    }
  }

  return jsonResponse({
    today,
    targets: targets.length,
    dailyUpserts,
    hourlyUpserts,
    normalsRefreshed,
    provider: 'open-meteo+nasa-power',
  });
}));
