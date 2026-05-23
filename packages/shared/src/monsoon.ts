// monsoon
// Phase 1 monsoon-onset predictor for Punjab. PMD doesn't expose a public API,
// so we derive a coarse outlook from 40-year NASA POWER climate normals and the
// current-year July rainfall anomaly observed so far. Outputs a normal/above/
// below band with a 7-day onset window centered on the climatological mean.

const POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const REQUEST_TIMEOUT_MS = 30_000;

// Climatological monsoon onset for Punjab (Lahore region): late June to early
// July. Mean onset ~ 1 July. We center a 7-day window around that.
const LAHORE_LAT = 31.5204;
const LAHORE_LNG = 74.3587;
const CLIMATOLOGICAL_ONSET_DAY_OF_YEAR = 182; // ~1 July

export interface MonsoonPrediction {
  year: number;
  predictedOnsetDate: string;
  confidenceLevel: 'low' | 'medium' | 'high';
  expectedIntensity: 'below_normal' | 'normal' | 'above_normal';
  source: string;
}

async function fetchWithTimeout(url: string, attempt = 0): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok && attempt === 0) {
      clearTimeout(t);
      return fetchWithTimeout(url, 1);
    }
    return res;
  } catch (err) {
    if (attempt === 0) return fetchWithTimeout(url, 1);
    throw err;
  } finally {
    clearTimeout(t);
  }
}

function isoForDayOfYear(year: number, doy: number): string {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(doy);
  return d.toISOString().slice(0, 10);
}

interface PowerDailyResponse {
  properties?: {
    parameter?: {
      PRECTOTCORR?: Record<string, number>;
    };
  };
}

async function fetchJunePrecipMean(lat: number, lng: number, year: number): Promise<number | null> {
  const start = `${year}0601`;
  const end = `${year}0630`;
  const url = `${POWER_URL}?parameters=PRECTOTCORR&community=AG&longitude=${lng}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const body = (await res.json()) as PowerDailyResponse;
    const prec = body.properties?.parameter?.PRECTOTCORR ?? {};
    const values = Object.values(prec).filter((v) => v !== -999);
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  } catch {
    return null;
  }
}

async function fetchClimateJuneNormal(lat: number, lng: number): Promise<number | null> {
  const url = `${POWER_URL}?parameters=PRECTOTCORR&community=AG&longitude=${lng}&latitude=${lat}&start=19810601&end=20201231&format=JSON`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const body = (await res.json()) as PowerDailyResponse;
    const prec = body.properties?.parameter?.PRECTOTCORR ?? {};
    const juneValues: number[] = [];
    for (const [k, v] of Object.entries(prec)) {
      if (v === -999) continue;
      if (k.length === 8 && k.slice(4, 6) === '06') juneValues.push(v);
    }
    if (juneValues.length === 0) return null;
    return juneValues.reduce((a, b) => a + b, 0) / juneValues.length;
  } catch {
    return null;
  }
}

export async function fetchMonsoonForecast(year: number): Promise<MonsoonPrediction | null> {
  const [currentJune, normalJune] = await Promise.all([
    fetchJunePrecipMean(LAHORE_LAT, LAHORE_LNG, year),
    fetchClimateJuneNormal(LAHORE_LAT, LAHORE_LNG),
  ]);
  if (normalJune === null) return null;

  let intensity: MonsoonPrediction['expectedIntensity'] = 'normal';
  let confidence: MonsoonPrediction['confidenceLevel'] = 'low';
  let onsetShiftDays = 0;

  if (currentJune !== null) {
    confidence = 'medium';
    const anomaly = (currentJune - normalJune) / Math.max(normalJune, 0.01);
    if (anomaly > 0.2) {
      intensity = 'above_normal';
      onsetShiftDays = -3;
    } else if (anomaly < -0.2) {
      intensity = 'below_normal';
      onsetShiftDays = 4;
    }
    if (Math.abs(anomaly) > 0.5) confidence = 'high';
  }

  const predictedOnsetDate = isoForDayOfYear(year, CLIMATOLOGICAL_ONSET_DAY_OF_YEAR + onsetShiftDays);
  return {
    year,
    predictedOnsetDate,
    confidenceLevel: confidence,
    expectedIntensity: intensity,
    source: 'nasa-power-derived',
  };
}
