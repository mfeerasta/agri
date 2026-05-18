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

function evaluateSlot(day: WeatherForecastDay, slot: CandidateSlot): SprayWindow {
  const warnings: string[] = [];
  const rationaleParts: string[] = [];
  let score = 1;

  // Adjust temp for time-of-day: morning and evening are cooler than mid-day max.
  const slotMaxTempC = day.minTempC + (day.maxTempC - day.minTempC) * slot.tempFactor;

  if (day.windKph > WIND_HARD_LIMIT_KPH) {
    score = 0;
    warnings.push(`wind ${day.windKph.toFixed(0)} kph exceeds ${WIND_HARD_LIMIT_KPH} kph drift limit`);
  } else if (day.windKph > WIND_HARD_LIMIT_KPH * 0.7) {
    score *= 0.7;
    rationaleParts.push(`moderate wind ${day.windKph.toFixed(0)} kph`);
  } else {
    rationaleParts.push(`calm ${day.windKph.toFixed(0)} kph`);
  }

  if (day.rainfallMm > RAIN_HARD_LIMIT_MM) {
    score = 0;
    warnings.push(`rainfall ${day.rainfallMm.toFixed(1)} mm risks wash-off`);
  } else if (day.rainfallMm > 0) {
    score *= 0.85;
    rationaleParts.push(`trace rain ${day.rainfallMm.toFixed(1)} mm`);
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

  if (day.humidityPct >= HUMIDITY_BONUS_LOW && day.humidityPct <= HUMIDITY_BONUS_HIGH) {
    score = clamp01(score * 1.1);
    rationaleParts.push(`optimal humidity ${day.humidityPct.toFixed(0)}%`);
  } else if (day.humidityPct < 30) {
    score *= 0.85;
    rationaleParts.push(`dry air ${day.humidityPct.toFixed(0)}%`);
  } else if (day.humidityPct > 90) {
    score *= 0.9;
    rationaleParts.push(`saturated air ${day.humidityPct.toFixed(0)}%`);
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
      windows.push(window);
    }
  }

  windows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.date.getTime() - b.date.getTime();
  });

  return windows.slice(0, 5);
}
