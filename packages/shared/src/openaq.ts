/**
 * OpenAQ v2 client. Free, no API key.
 *
 * Fetches the latest measurements within radius of a coordinate, groups by
 * station, takes the freshest reading per parameter, and computes a
 * conservative EPA AQI from the dominant pollutant. Lahore is one of the
 * worst smog cities in the world during winter, so this drives spray-window
 * and outdoor-worker decisions.
 */

const OPENAQ_BASE = 'https://api.openaq.org/v2';
const TIMEOUT_MS = 30_000;

export type AirQualityLevel =
  | 'good'
  | 'moderate'
  | 'unhealthy_sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export interface AirQualityReading {
  stationName: string;
  pm25?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  co?: number;
  fetchedAt: string;
  aqi?: number;
  level: AirQualityLevel;
}

interface OpenAQMeasurement {
  location?: string;
  parameter?: string;
  value?: number;
  unit?: string;
  date?: { utc?: string };
  coordinates?: { latitude?: number; longitude?: number };
}

interface OpenAQResponse {
  results?: OpenAQMeasurement[];
}

function timedFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchWithRetry(url: string): Promise<Response> {
  try {
    const res = await timedFetch(url);
    if (res.ok) return res;
    throw new Error(`OpenAQ ${res.status}`);
  } catch {
    return timedFetch(url);
  }
}

// EPA breakpoints for PM2.5 (24h avg, ug/m3) and PM10 (24h, ug/m3).
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

function aqiFromBreakpoints(c: number, table: Array<[number, number, number, number]>): number | undefined {
  for (const [cLo, cHi, iLo, iHi] of table) {
    if (c >= cLo && c <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo);
    }
  }
  return undefined;
}

function levelForAqi(aqi: number): AirQualityLevel {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy_sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very_unhealthy';
  return 'hazardous';
}

function computeAqi(pm25?: number, pm10?: number): number | undefined {
  const a = typeof pm25 === 'number' ? aqiFromBreakpoints(pm25, PM25_BREAKS) : undefined;
  const b = typeof pm10 === 'number' ? aqiFromBreakpoints(pm10, PM10_BREAKS) : undefined;
  if (a === undefined && b === undefined) return undefined;
  return Math.max(a ?? 0, b ?? 0);
}

export async function fetchNearestStation({
  lat,
  lng,
  radiusKm = 30,
}: {
  lat: number;
  lng: number;
  radiusKm?: number;
}): Promise<AirQualityReading | null> {
  const radiusM = Math.min(Math.max(1, Math.round(radiusKm * 1000)), 25000);
  const params = new URLSearchParams();
  params.set('coordinates', `${lat},${lng}`);
  params.set('radius', String(radiusM));
  params.set('limit', '50');
  params.set('order_by', 'datetime');
  params.set('sort', 'desc');
  for (const p of ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co']) {
    params.append('parameter', p);
  }

  let res: Response;
  try {
    res = await fetchWithRetry(`${OPENAQ_BASE}/measurements?${params.toString()}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const json = (await res.json()) as OpenAQResponse;
  const measurements = json.results ?? [];
  if (measurements.length === 0) return null;

  // Bucket by station, keep freshest per parameter.
  type StationBucket = {
    name: string;
    latest: number;
    params: Record<string, { value: number; date: number }>;
  };
  const stations = new Map<string, StationBucket>();
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

  // Pick the station with the freshest data.
  let best: StationBucket | null = null;
  for (const s of stations.values()) {
    if (!best || s.latest > best.latest) best = s;
  }
  if (!best) return null;

  const pm25 = best.params.pm25?.value;
  const pm10 = best.params.pm10?.value;
  const no2 = best.params.no2?.value;
  const o3 = best.params.o3?.value;
  const so2 = best.params.so2?.value;
  const co = best.params.co?.value;
  const aqi = computeAqi(pm25, pm10);

  return {
    stationName: best.name,
    pm25,
    pm10,
    no2,
    o3,
    so2,
    co,
    fetchedAt: new Date().toISOString(),
    aqi,
    level: typeof aqi === 'number' ? levelForAqi(aqi) : 'moderate',
  };
}

export function aqiAdvisoryUr(level: AirQualityLevel): string {
  switch (level) {
    case 'good':
      return 'ہوا صاف ہے۔';
    case 'moderate':
      return 'ہوا قابل قبول ہے۔ حساس افراد احتیاط کریں۔';
    case 'unhealthy_sensitive':
      return 'بزرگ اور بچے سخت محنت سے گریز کریں۔';
    case 'unhealthy':
      return 'تمام ورکر ماسک پہنیں۔ بیرونی سپرے ملتوی کریں۔';
    case 'very_unhealthy':
      return 'دھواں بہت زیادہ ہے۔ صرف ضروری کام۔';
    case 'hazardous':
      return 'خطرناک سموگ۔ بیرونی کام بند کریں۔';
  }
}
