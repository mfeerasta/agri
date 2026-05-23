/**
 * Pure scenario math for the what-if planner. No DB, no env.
 * All amounts PKR. Yields in kg.
 */

export interface FeasibilityCostBreakdown {
  seed?: number;
  fertilizer?: number;
  pesticide?: number;
  irrigation?: number;
  labour?: number;
  diesel?: number;
  repair?: number;
  other?: number;
}

export const COST_KEYS = [
  'seed',
  'fertilizer',
  'pesticide',
  'irrigation',
  'labour',
  'diesel',
  'repair',
  'other',
] as const;

export type CostKey = (typeof COST_KEYS)[number];

export interface ScenarioInputs {
  totalAcres: number;
  yieldPerAcreKg: number;
  pricePerKgPkr: number;
  costBreakdown: FeasibilityCostBreakdown; // per-acre values
  seasonDurationMonths?: number;
}

export interface ScenarioComputed {
  revenuePkr: number;
  totalCostPkr: number;
  netPkr: number;
  netPerAcrePkr: number;
  costPerAcrePkr: number;
  yieldKgTotal: number;
  paybackMonths: number | null;
  irrPct: number | null;
}

export function sumCostPerAcre(b: FeasibilityCostBreakdown): number {
  let s = 0;
  for (const k of COST_KEYS) s += Number(b[k] ?? 0) || 0;
  return Number(s.toFixed(2));
}

export function computeScenario(input: ScenarioInputs): ScenarioComputed {
  const acres = Math.max(0, Number(input.totalAcres) || 0);
  const ypa = Math.max(0, Number(input.yieldPerAcreKg) || 0);
  const price = Math.max(0, Number(input.pricePerKgPkr) || 0);
  const costPerAcre = sumCostPerAcre(input.costBreakdown);
  const yieldKgTotal = acres * ypa;
  const revenuePkr = Number((yieldKgTotal * price).toFixed(2));
  const totalCostPkr = Number((acres * costPerAcre).toFixed(2));
  const netPkr = Number((revenuePkr - totalCostPkr).toFixed(2));
  const netPerAcrePkr = acres > 0 ? Number((netPkr / acres).toFixed(2)) : 0;

  const duration = Math.max(1, Number(input.seasonDurationMonths ?? 6));
  let paybackMonths: number | null = null;
  if (netPkr > 0 && totalCostPkr > 0) {
    paybackMonths = Number(((totalCostPkr / netPkr) * duration).toFixed(2));
  }
  let irrPct: number | null = null;
  if (totalCostPkr > 0) {
    const seasonReturn = netPkr / totalCostPkr;
    const annualised = seasonReturn * (12 / duration);
    irrPct = Number((annualised * 100).toFixed(3));
  }

  return {
    revenuePkr,
    totalCostPkr,
    netPkr,
    netPerAcrePkr,
    costPerAcrePkr: costPerAcre,
    yieldKgTotal: Number(yieldKgTotal.toFixed(2)),
    paybackMonths,
    irrPct,
  };
}

export function applySensitivity(
  base: ScenarioInputs,
  yieldDeltaPct: number,
  priceDeltaPct: number,
): ScenarioInputs {
  return {
    ...base,
    yieldPerAcreKg: base.yieldPerAcreKg * (1 + yieldDeltaPct / 100),
    pricePerKgPkr: base.pricePerKgPkr * (1 + priceDeltaPct / 100),
  };
}
