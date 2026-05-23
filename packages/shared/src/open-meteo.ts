// open-meteo
// Free, keyless weather client for forecast + historical + agroclimatology.
// Source: https://open-meteo.com/en/docs
// Provides daily + hourly forecast (16d), ET0 (FAO Penman-Monteith), soil
// moisture at 4 depths, GDD computed client-side, frost-hour and leaf-wetness
// derivations. All temperatures in C, distances in km, rainfall in mm.

export interface OpenMeteoForecast {
  date: string;
  minTempC: number;
  maxTempC: number;
  meanTempC: number;
  rainfallMm: number;
  humidityPct: number;
  windKph: number;
  windGustKph: number;
  windDirectionDeg: number;
  pressureHpa: number;
  cloudCoverPct: number;
  uvIndex: number;
  sunriseLocal: string;
  sunsetLocal: string;
  daylightHours: number;
  soilTemperature0cmC?: number;
  soilMoisture0to10cmM3M3?: number;
  soilMoisture10to40cmM3M3?: number;
  soilMoisture40to100cmM3M3?: number;
  et0Mm: number;
  gddAccumulated?: number;
  frostHours?: number;
  leafWetnessHours?: number;
}

export interface OpenMeteoHourly {
  timeIso: string;
  tempC: number;
  rainfallMm: number;
  humidityPct: number;
  windKph: number;
  windGustKph: number;
  uvIndex: number;
  soilMoisture0to10cm?: number;
  cloudCoverPct: number;
}

export interface FetchForecastInput {
  lat: number;
  lng: number;
  days?: number;
  timezone?: string;
  baseTempC?: number;
}

export interface FetchForecastResult {
  daily: OpenMeteoForecast[];
  hourly: OpenMeteoHourly[];
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
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
  'soil_moisture_1_to_3cm',
  'soil_moisture_3_to_9cm',
  'soil_moisture_9_to_27cm',
].join(',');

interface OpenMeteoApiResponse {
  daily?: {
    time?: string[];
    temperature_2m_min?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_mean?: (number | null)[];
    precipitation_sum?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    wind_gusts_10m_max?: (number | null)[];
    wind_direction_10m_dominant?: (number | null)[];
    surface_pressure_mean?: (number | null)[];
    cloud_cover_mean?: (number | null)[];
    relative_humidity_2m_mean?: (number | null)[];
    et0_fao_evapotranspiration?: (number | null)[];
    uv_index_max?: (number | null)[];
    sunrise?: string[];
    sunset?: string[];
    daylight_duration?: (number | null)[];
    soil_temperature_0_to_7cm_mean?: (number | null)[];
    soil_moisture_0_to_10cm_mean?: (number | null)[];
    soil_moisture_10_to_40cm_mean?: (number | null)[];
    soil_moisture_40_to_100cm_mean?: (number | null)[];
  };
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    precipitation?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
    uv_index?: (number | null)[];
    cloud_cover?: (number | null)[];
    soil_moisture_0_to_1cm?: (number | null)[];
    soil_moisture_1_to_3cm?: (number | null)[];
    soil_moisture_3_to_9cm?: (number | null)[];
    soil_moisture_9_to_27cm?: (number | null)[];
  };
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function optNum(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function fetchWithRetry(url: string): Promise<OpenMeteoApiResponse> {
  const attempt = async (): Promise<OpenMeteoApiResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`open-meteo http ${res.status}`);
      }
      return (await res.json()) as OpenMeteoApiResponse;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    return await attempt().catch((retryErr) => {
      throw new Error(`open-meteo fetch failed: ${(err as Error).message} / ${(retryErr as Error).message}`);
    });
  }
}

/**
 * GDD using simple average method: max(0, (Tmax + Tmin)/2 - baseTempC).
 * Base temperature varies by crop: wheat 5C, maize 10C, cotton 15C.
 */
export function computeGdd(maxTempC: number, minTempC: number, baseTempC: number): number {
  const mean = (maxTempC + minTempC) / 2;
  const delta = mean - baseTempC;
  return delta > 0 ? delta : 0;
}

/**
 * Frost hours: count of hourly samples where temperature is below 2C.
 */
export function computeFrostHours(hourly: OpenMeteoHourly[], dateIso: string): number {
  let count = 0;
  for (const h of hourly) {
    if (h.timeIso.startsWith(dateIso) && h.tempC < 2) count += 1;
  }
  return count;
}

/**
 * Leaf wetness proxy: hours with humidity > 90 within 12h of measurable rain.
 * Surrogate for actual leaf-wetness sensors.
 */
export function computeLeafWetnessHours(hourly: OpenMeteoHourly[], dateIso: string): number {
  const samples = hourly.filter((h) => h.timeIso.startsWith(dateIso));
  let count = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    if (!s || s.humidityPct <= 90) continue;
    let rainNearby = false;
    const lower = Math.max(0, i - 12);
    const upper = Math.min(samples.length - 1, i + 12);
    for (let j = lower; j <= upper; j += 1) {
      const r = samples[j];
      if (r && r.rainfallMm > 0.1) {
        rainNearby = true;
        break;
      }
    }
    if (rainNearby) count += 1;
  }
  return count;
}

export async function fetchForecast({
  lat,
  lng,
  days = 16,
  timezone = 'Asia/Karachi',
  baseTempC,
}: FetchForecastInput): Promise<FetchForecastResult> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone,
    forecast_days: String(days),
    daily: DAILY_PARAMS,
    hourly: HOURLY_PARAMS,
    wind_speed_unit: 'kmh',
  });
  const data = await fetchWithRetry(`${FORECAST_URL}?${params.toString()}`);

  const hourly: OpenMeteoHourly[] = [];
  const times: string[] = data.hourly?.time ?? [];
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    if (!t) continue;
    hourly.push({
      timeIso: t,
      tempC: num(data.hourly?.temperature_2m?.[i]),
      rainfallMm: num(data.hourly?.precipitation?.[i]),
      humidityPct: num(data.hourly?.relative_humidity_2m?.[i]),
      windKph: num(data.hourly?.wind_speed_10m?.[i]),
      windGustKph: num(data.hourly?.wind_gusts_10m?.[i]),
      uvIndex: num(data.hourly?.uv_index?.[i]),
      cloudCoverPct: num(data.hourly?.cloud_cover?.[i]),
      soilMoisture0to10cm: optNum(data.hourly?.soil_moisture_0_to_1cm?.[i]),
    });
  }

  const daily: OpenMeteoForecast[] = [];
  const dailyTimes: string[] = data.daily?.time ?? [];
  let gddRunning = 0;
  for (let i = 0; i < dailyTimes.length; i += 1) {
    const date = dailyTimes[i];
    if (!date) continue;
    const minT = num(data.daily?.temperature_2m_min?.[i]);
    const maxT = num(data.daily?.temperature_2m_max?.[i]);
    const meanT = num(data.daily?.temperature_2m_mean?.[i] ?? (minT + maxT) / 2);
    const sunrise = data.daily?.sunrise?.[i] ?? '';
    const sunset = data.daily?.sunset?.[i] ?? '';

    let gdd: number | undefined;
    if (typeof baseTempC === 'number') {
      gddRunning += computeGdd(maxT, minT, baseTempC);
      gdd = gddRunning;
    }

    daily.push({
      date,
      minTempC: minT,
      maxTempC: maxT,
      meanTempC: meanT,
      rainfallMm: num(data.daily?.precipitation_sum?.[i]),
      humidityPct: num(data.daily?.relative_humidity_2m_mean?.[i]),
      windKph: num(data.daily?.wind_speed_10m_max?.[i]),
      windGustKph: num(data.daily?.wind_gusts_10m_max?.[i]),
      windDirectionDeg: num(data.daily?.wind_direction_10m_dominant?.[i]),
      pressureHpa: num(data.daily?.surface_pressure_mean?.[i]),
      cloudCoverPct: num(data.daily?.cloud_cover_mean?.[i]),
      uvIndex: num(data.daily?.uv_index_max?.[i]),
      sunriseLocal: sunrise,
      sunsetLocal: sunset,
      daylightHours: num(data.daily?.daylight_duration?.[i]) / 3600,
      soilTemperature0cmC: optNum(data.daily?.soil_temperature_0_to_7cm_mean?.[i]),
      soilMoisture0to10cmM3M3: optNum(data.daily?.soil_moisture_0_to_10cm_mean?.[i]),
      soilMoisture10to40cmM3M3: optNum(data.daily?.soil_moisture_10_to_40cm_mean?.[i]),
      soilMoisture40to100cmM3M3: optNum(data.daily?.soil_moisture_40_to_100cm_mean?.[i]),
      et0Mm: num(data.daily?.et0_fao_evapotranspiration?.[i]),
      gddAccumulated: gdd,
      frostHours: computeFrostHours(hourly, date),
      leafWetnessHours: computeLeafWetnessHours(hourly, date),
    });
  }

  return { daily, hourly };
}

export interface FetchHistoricalInput {
  lat: number;
  lng: number;
  fromDate: string;
  toDate: string;
  timezone?: string;
}

export async function fetchHistorical({
  lat,
  lng,
  fromDate,
  toDate,
  timezone = 'Asia/Karachi',
}: FetchHistoricalInput): Promise<OpenMeteoForecast[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone,
    start_date: fromDate,
    end_date: toDate,
    daily: DAILY_PARAMS,
    wind_speed_unit: 'kmh',
  });
  const data = await fetchWithRetry(`${ARCHIVE_URL}?${params.toString()}`);

  const daily: OpenMeteoForecast[] = [];
  const dailyTimes: string[] = data.daily?.time ?? [];
  for (let i = 0; i < dailyTimes.length; i += 1) {
    const date = dailyTimes[i];
    if (!date) continue;
    const minT = num(data.daily?.temperature_2m_min?.[i]);
    const maxT = num(data.daily?.temperature_2m_max?.[i]);
    daily.push({
      date,
      minTempC: minT,
      maxTempC: maxT,
      meanTempC: num(data.daily?.temperature_2m_mean?.[i] ?? (minT + maxT) / 2),
      rainfallMm: num(data.daily?.precipitation_sum?.[i]),
      humidityPct: num(data.daily?.relative_humidity_2m_mean?.[i]),
      windKph: num(data.daily?.wind_speed_10m_max?.[i]),
      windGustKph: num(data.daily?.wind_gusts_10m_max?.[i]),
      windDirectionDeg: num(data.daily?.wind_direction_10m_dominant?.[i]),
      pressureHpa: num(data.daily?.surface_pressure_mean?.[i]),
      cloudCoverPct: num(data.daily?.cloud_cover_mean?.[i]),
      uvIndex: num(data.daily?.uv_index_max?.[i]),
      sunriseLocal: data.daily?.sunrise?.[i] ?? '',
      sunsetLocal: data.daily?.sunset?.[i] ?? '',
      daylightHours: num(data.daily?.daylight_duration?.[i]) / 3600,
      soilTemperature0cmC: optNum(data.daily?.soil_temperature_0_to_7cm_mean?.[i]),
      soilMoisture0to10cmM3M3: optNum(data.daily?.soil_moisture_0_to_10cm_mean?.[i]),
      soilMoisture10to40cmM3M3: optNum(data.daily?.soil_moisture_10_to_40cm_mean?.[i]),
      soilMoisture40to100cmM3M3: optNum(data.daily?.soil_moisture_40_to_100cm_mean?.[i]),
      et0Mm: num(data.daily?.et0_fao_evapotranspiration?.[i]),
    });
  }
  return daily;
}

export const CROP_BASE_TEMP_C: Record<string, number> = {
  wheat: 5,
  barley: 5,
  maize: 10,
  rice: 10,
  cotton: 15,
  sugarcane: 12,
  tomato: 10,
  potato: 7,
};

export function baseTempForCrop(cropName: string): number {
  const key = cropName.trim().toLowerCase();
  return CROP_BASE_TEMP_C[key] ?? 10;
}
