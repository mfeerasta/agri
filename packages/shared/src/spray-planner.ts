// spray-planner
// Recommends spray windows based on a 7-day forecast plus pesticide constraints.
// Pure function, no DB access. Used by the planner UI and any server action that
// wants to schedule a spray task. Scoring is intentionally explainable: each
// rule writes into rationale or warnings so a worker can see why a window won.

export interface WeatherForecastDay {
  date: Date;
  minTempC: number;
  maxTempC: number;
  rainfallMm: number;
  humidityPct: number;
  windKph: number;
  /** Optional hourly slice for this day (08:00-20:00 local). */
  hourly?: WeatherForecastHour[];
}

export interface WeatherForecastHour {
  localHour: number;
  tempC: number;
  rainfallMm: number;
  humidityPct: number;
  windKph: number;
  windGustKph?: number;
}

export interface SprayWindow {
  date: Date;
  startLocalHour: number;
  endLocalHour: number;
  score: number;
  rationale: string;
  warnings: string[];
}

export interface SprayPlanInput {
  cropPlanId: string;
  pesticideName: string;
  preHarvestIntervalDays: number;
  forecastDays: WeatherForecastDay[];
  daysToHarvestEstimate?: number;
  /**
   * When true (Ramadan active), penalize any slot overlapping the 12:00-16:00
   * window because fasting workers shouldn't spray in extreme heat.
   */
  ramadanActive?: boolean;
}

interface CandidateSlot {
  label: 'morning' | 'evening';
  startLocalHour: number;
  endLocalHour: number;
  tempFactor: number;
}

const CANDIDATE_SLOTS: readonly CandidateSlot[] = [
  { label: 'morning', startLocalHour: 6, endLocalHour: 9, tempFactor: 0.85 },
  { label: 'evening', startLocalHour: 17, endLocalHour: 19, tempFactor: 0.9 },
];

const WIND_HARD_LIMIT_KPH = 12;
const RAIN_HARD_LIMIT_MM = 1;
const TEMP_DEGRADATION_C = 35;
const HUMIDITY_BONUS_LOW = 50;
const HUMIDITY_BONUS_HIGH = 80;

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function slotAggregates(day: WeatherForecastDay, slot: CandidateSlot): {
  tempC: number;
  windKph: number;
  windGustKph: number;
  rainMm: number;
  humidityPct: number;
  sourcedFromHourly: boolean;
} {
  if (day.hourly && day.hourly.length > 0) {
    const inSlot = day.hourly.filter((h) => h.localHour >= slot.startLocalHour && h.localHour < slot.endLocalHour);
    if (inSlot.length > 0) {
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      return {
        tempC: avg(inSlot.map((h) => h.tempC)),
        windKph: Math.max(...inSlot.map((h) => h.windKph)),
        windGustKph: Math.max(...inSlot.map((h) => h.windGustKph ?? h.windKph)),
        rainMm: inSlot.reduce((a, b) => a + b.rainfallMm, 0),
        humidityPct: avg(inSlot.map((h) => h.humidityPct)),
        sourcedFromHourly: true,
      };
    }
  }
  return {
    tempC: day.minTempC + (day.maxTempC - day.minTempC) * slot.tempFactor,
    windKph: day.windKph,
    windGustKph: day.windKph,
    rainMm: day.rainfallMm,
    humidityPct: day.humidityPct,
    sourcedFromHourly: false,
  };
}

function evaluateSlot(day: WeatherForecastDay, slot: CandidateSlot): SprayWindow {
  const warnings: string[] = [];
  const rationaleParts: string[] = [];
  let score = 1;

  const agg = slotAggregates(day, slot);
  const slotMaxTempC = agg.tempC;
  if (agg.sourcedFromHourly) rationaleParts.push('hourly');

  if (agg.windKph > WIND_HARD_LIMIT_KPH) {
    score = 0;
    warnings.push(`wind ${agg.windKph.toFixed(0)} kph exceeds ${WIND_HARD_LIMIT_KPH} kph drift limit`);
  } else if (agg.windKph > WIND_HARD_LIMIT_KPH * 0.7) {
    score *= 0.7;
    rationaleParts.push(`moderate wind ${agg.windKph.toFixed(0)} kph`);
  } else {
    rationaleParts.push(`calm ${agg.windKph.toFixed(0)} kph`);
  }

  if (agg.rainMm > RAIN_HARD_LIMIT_MM) {
    score = 0;
    warnings.push(`rainfall ${agg.rainMm.toFixed(1)} mm risks wash-off`);
  } else if (agg.rainMm > 0) {
    score *= 0.85;
    rationaleParts.push(`trace rain ${agg.rainMm.toFixed(1)} mm`);
  } else {
    rationaleParts.push('dry');
  }

  if (slotMaxTempC > TEMP_DEGRADATION_C) {
    score = Math.min(score, 0.3);
    warnings.push(`temp ~${slotMaxTempC.toFixed(0)}C degrades chemistry`);
  } else if (slotMaxTempC > 30) {
    score *= 0.8;
    rationaleParts.push(`warm ${slotMaxTempC.toFixed(0)}C`);
  } else {
    rationaleParts.push(`mild ${slotMaxTempC.toFixed(0)}C`);
  }

  if (agg.humidityPct >= HUMIDITY_BONUS_LOW && agg.humidityPct <= HUMIDITY_BONUS_HIGH) {
    score = clamp01(score * 1.1);
    rationaleParts.push(`optimal humidity ${agg.humidityPct.toFixed(0)}%`);
  } else if (agg.humidityPct < 30) {
    score *= 0.85;
    rationaleParts.push(`dry air ${agg.humidityPct.toFixed(0)}%`);
  } else if (agg.humidityPct > 90) {
    score *= 0.9;
    rationaleParts.push(`saturated air ${agg.humidityPct.toFixed(0)}%`);
  }

  return {
    date: day.date,
    startLocalHour: slot.startLocalHour,
    endLocalHour: slot.endLocalHour,
    score: clamp01(score),
    rationale: `${slot.label}: ${rationaleParts.join(', ')}`,
    warnings,
  };
}

export function planSprayWindows(input: SprayPlanInput): SprayWindow[] {
  const windows: SprayWindow[] = [];
  const phiViolatesHarvest =
    typeof input.daysToHarvestEstimate === 'number' &&
    input.preHarvestIntervalDays > input.daysToHarvestEstimate;

  for (const day of input.forecastDays) {
    for (const slot of CANDIDATE_SLOTS) {
      const window = evaluateSlot(day, slot);
      if (phiViolatesHarvest) {
        window.score = 0;
        window.warnings.push(
          `PHI ${input.preHarvestIntervalDays}d > days-to-harvest ${input.daysToHarvestEstimate}d, residue risk`,
        );
      }
      if (input.ramadanActive && window.startLocalHour < 16 && window.endLocalHour > 12) {
        window.score = 0;
        window.warnings.push('Ramadan: avoid mid-day spray with fasting workers');
      }
      windows.push(window);
    }
  }

  windows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.date.getTime() - b.date.getTime();
  });

  return windows.slice(0, 5);
}
