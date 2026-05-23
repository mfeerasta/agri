// nasa-power
// Free, keyless NASA POWER agroclimatology client.
// Source: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
// Used for 40-year climate normals and ET0/solar radiation historical
// validation. Community 'AG' returns agroclimate-tuned parameters.

export interface NasaPowerDaily {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  tempMeanC: number;
  precipitationMm: number;
  solarRadiationMjPerM2: number;
  et0Mm: number;
  windKph: number;
  humidityPct: number;
}

export interface ClimateNormals {
  monthlyMeanTempC: number[];
  monthlyTotalRainMm: number[];
  monthlyEt0Mm: number[];
}

export interface FetchPowerDailyInput {
  lat: number;
  lng: number;
  fromDate: string;
  toDate: string;
}

export interface FetchClimateNormalsInput {
  lat: number;
  lng: number;
  startYear?: number;
  endYear?: number;
}

const POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const REQUEST_TIMEOUT_MS = 30_000;

const POWER_PARAMETERS = [
  'T2M_MIN',
  'T2M_MAX',
  'T2M',
  'PRECTOTCORR',
  'ALLSKY_SFC_SW_DWN',
  'EVPTRNS',
  'WS10M',
  'RH2M',
].join(',');

const FILL_VALUE = -999;

interface PowerApiResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
}

function clean(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === FILL_VALUE) return 0;
  return value;
}

function toIso(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function toCompact(iso: string): string {
  return iso.replace(/-/g, '');
}

async function powerFetchWithRetry(url: string): Promise<PowerApiResponse> {
  const attempt = async (): Promise<PowerApiResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`nasa-power http ${res.status}`);
      return (await res.json()) as PowerApiResponse;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    return await attempt().catch((retryErr) => {
      throw new Error(`nasa-power fetch failed: ${(err as Error).message} / ${(retryErr as Error).message}`);
    });
  }
}

export async function fetchPowerDaily({
  lat,
  lng,
  fromDate,
  toDate,
}: FetchPowerDailyInput): Promise<NasaPowerDaily[]> {
  const params = new URLSearchParams({
    parameters: POWER_PARAMETERS,
    community: 'AG',
    latitude: String(lat),
    longitude: String(lng),
    start: toCompact(fromDate),
    end: toCompact(toDate),
    format: 'JSON',
  });
  const data = await powerFetchWithRetry(`${POWER_URL}?${params.toString()}`);
  const p = data.properties?.parameter ?? {};
  const tMin = p.T2M_MIN ?? {};
  const tMax = p.T2M_MAX ?? {};
  const tMean = p.T2M ?? {};
  const rain = p.PRECTOTCORR ?? {};
  const solar = p.ALLSKY_SFC_SW_DWN ?? {};
  const et0 = p.EVPTRNS ?? {};
  const wind = p.WS10M ?? {};
  const rh = p.RH2M ?? {};

  const dates = Object.keys(tMean).sort();
  return dates.map((d) => ({
    date: toIso(d),
    tempMinC: clean(tMin[d]),
    tempMaxC: clean(tMax[d]),
    tempMeanC: clean(tMean[d]),
    precipitationMm: clean(rain[d]),
    solarRadiationMjPerM2: clean(solar[d]),
    et0Mm: clean(et0[d]),
    windKph: clean(wind[d]) * 3.6,
    humidityPct: clean(rh[d]),
  }));
}

export async function fetchClimateNormals({
  lat,
  lng,
  startYear = 1984,
  endYear = 2024,
}: FetchClimateNormalsInput): Promise<ClimateNormals> {
  const fromDate = `${startYear}-01-01`;
  const toDate = `${endYear}-12-31`;
  const daily = await fetchPowerDaily({ lat, lng, fromDate, toDate });

  const tempSums = new Array<number>(12).fill(0);
  const tempCounts = new Array<number>(12).fill(0);
  const rainByYearMonth = new Map<string, number>();
  const et0ByYearMonth = new Map<string, number>();

  for (const d of daily) {
    const month = Number(d.date.slice(5, 7)) - 1;
    const year = d.date.slice(0, 4);
    tempSums[month] += d.tempMeanC;
    tempCounts[month] += 1;
    const rainKey = `${year}-${month}`;
    rainByYearMonth.set(rainKey, (rainByYearMonth.get(rainKey) ?? 0) + d.precipitationMm);
    et0ByYearMonth.set(rainKey, (et0ByYearMonth.get(rainKey) ?? 0) + d.et0Mm);
  }

  const monthlyMeanTempC = tempSums.map((s, i) => (tempCounts[i] > 0 ? s / tempCounts[i] : 0));

  const rainBuckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const [key, total] of rainByYearMonth.entries()) {
    const month = Number(key.split('-')[1]);
    rainBuckets[month].push(total);
  }
  const monthlyTotalRainMm = rainBuckets.map((arr) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length,
  );

  const et0Buckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const [key, total] of et0ByYearMonth.entries()) {
    const month = Number(key.split('-')[1]);
    et0Buckets[month].push(total);
  }
  const monthlyEt0Mm = et0Buckets.map((arr) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length,
  );

  return { monthlyMeanTempC, monthlyTotalRainMm, monthlyEt0Mm };
}
