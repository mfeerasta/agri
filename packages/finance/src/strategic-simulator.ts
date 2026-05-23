/**
 * Strategic 5-year scenario simulator.
 *
 * Pure math. No DB writes. The server action calls runScenario, then persists
 * the result to scenario_simulations. All amounts in PKR. Discount rate is
 * an input (typical agri hurdle in PK is 14-18% nominal).
 *
 * Monte Carlo: samples yield, price, and weather multiplier per year from
 * normal distributions, then aggregates 1000 iterations into p5/p50/p95 bands.
 */

export interface FieldYearAssumption {
  fieldId: string;
  year: number;
  cropCode: string;
  acres: number;
  yieldPerAcreKg: number;
  yieldVariancePct: number;
  pricePerKgPkr: number;
  priceVariancePct: number;
  opexPerAcrePkr: number;
}

export interface CapexItem {
  name: string;
  year: number;
  amountPkr: number;
  usefulLifeYears: number;
  financedPct: number;
  loanRatePct: number;
  loanTermYears: number;
}

export interface ScenarioInputs {
  baseYear: number;
  horizonYears: number;
  discountRatePct: number;
  weatherRiskPct: number;
  inflationPct: number;
  fixedOpexPerYearPkr: number;
  fieldYearAssumptions: FieldYearAssumption[];
  capexItems: CapexItem[];
  monteCarloIterations?: number;
}

export interface ScenarioYearOutput {
  year: number;
  revenuePkr: number;
  opexPkr: number;
  capexPkr: number;
  financingPkr: number;
  netCashFlowPkr: number;
  cumulativeCashPkr: number;
}

export interface MonteCarloPercentiles {
  p5: number[];
  p50: number[];
  p95: number[];
  npvP5: number;
  npvP50: number;
  npvP95: number;
}

export interface ScenarioResult {
  yearly: ScenarioYearOutput[];
  npvPkr: number;
  irrPct: number | null;
  paybackYears: number | null;
  monteCarlo?: MonteCarloPercentiles;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function gaussian(mean: number, stdev: number): number {
  // Box-Muller. Stdev expressed as absolute, not pct.
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdev;
}

function annuityPayment(principal: number, ratePct: number, years: number): number {
  if (years <= 0 || principal <= 0) return 0;
  const r = ratePct / 100;
  if (r === 0) return principal / years;
  return (principal * r) / (1 - Math.pow(1 + r, -years));
}

function npv(rates: number[], discountRatePct: number): number {
  const r = discountRatePct / 100;
  let total = 0;
  rates.forEach((cf, i) => {
    total += cf / Math.pow(1 + r, i + 1);
  });
  return total;
}

function irr(cashFlows: number[], guess = 0.15): number | null {
  // Newton-Raphson with safety bounds.
  let rate = guess;
  for (let iter = 0; iter < 100; iter++) {
    let f = 0;
    let df = 0;
    cashFlows.forEach((cf, i) => {
      f += cf / Math.pow(1 + rate, i);
      df += (-i * cf) / Math.pow(1 + rate, i + 1);
    });
    if (Math.abs(df) < 1e-10) return null;
    const next = rate - f / df;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - rate) < 1e-6) return Number((next * 100).toFixed(3));
    rate = next;
  }
  return null;
}

function computeYearly(inputs: ScenarioInputs, sampled: boolean): ScenarioYearOutput[] {
  const out: ScenarioYearOutput[] = [];
  let cumulative = 0;
  for (let y = 0; y < inputs.horizonYears; y++) {
    const year = inputs.baseYear + y;
    let revenue = 0;
    let opex = 0;
    let capex = 0;
    let financing = 0;

    const yearAssumptions = inputs.fieldYearAssumptions.filter((a) => a.year === year);
    for (const a of yearAssumptions) {
      const yieldStdev = (a.yieldPerAcreKg * a.yieldVariancePct) / 100;
      const priceStdev = (a.pricePerKgPkr * a.priceVariancePct) / 100;
      const yieldKg = sampled ? Math.max(0, gaussian(a.yieldPerAcreKg, yieldStdev)) : a.yieldPerAcreKg;
      const price = sampled ? Math.max(0, gaussian(a.pricePerKgPkr, priceStdev)) : a.pricePerKgPkr;
      const weatherMult = sampled
        ? Math.max(0, gaussian(1, inputs.weatherRiskPct / 100))
        : 1;
      revenue += a.acres * yieldKg * price * weatherMult;
      opex += a.acres * a.opexPerAcrePkr * Math.pow(1 + inputs.inflationPct / 100, y);
    }

    opex += inputs.fixedOpexPerYearPkr * Math.pow(1 + inputs.inflationPct / 100, y);

    for (const c of inputs.capexItems) {
      if (c.year === year) {
        const cashOut = c.amountPkr * (1 - c.financedPct / 100);
        capex += cashOut;
      }
      const principalFinanced = c.amountPkr * (c.financedPct / 100);
      if (principalFinanced > 0 && year >= c.year && year < c.year + c.loanTermYears) {
        financing += annuityPayment(principalFinanced, c.loanRatePct, c.loanTermYears);
      }
    }

    const net = revenue - opex - capex - financing;
    cumulative += net;
    out.push({
      year,
      revenuePkr: round2(revenue),
      opexPkr: round2(opex),
      capexPkr: round2(capex),
      financingPkr: round2(financing),
      netCashFlowPkr: round2(net),
      cumulativeCashPkr: round2(cumulative),
    });
  }
  return out;
}

export function runScenario(inputs: ScenarioInputs): ScenarioResult {
  const yearly = computeYearly(inputs, false);
  const cashFlows = yearly.map((y) => y.netCashFlowPkr);
  const npvPkr = round2(npv(cashFlows, inputs.discountRatePct));
  const irrPct = irr([-Math.abs(inputs.capexItems.reduce((s, c) => s + c.amountPkr * (1 - c.financedPct / 100), 0)), ...cashFlows]);

  let paybackYears: number | null = null;
  let cum = 0;
  for (let i = 0; i < yearly.length; i++) {
    cum += yearly[i].netCashFlowPkr;
    if (cum >= 0 && paybackYears === null) {
      paybackYears = Number((i + 1).toFixed(2));
      break;
    }
  }

  let monteCarlo: MonteCarloPercentiles | undefined;
  const iterations = inputs.monteCarloIterations ?? 0;
  if (iterations > 0) {
    const allRuns: number[][] = [];
    const npvSamples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const run = computeYearly(inputs, true);
      const cfs = run.map((y) => y.netCashFlowPkr);
      allRuns.push(cfs);
      npvSamples.push(npv(cfs, inputs.discountRatePct));
    }
    const pickPercentile = (arr: number[], p: number): number => {
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
      return sorted[idx];
    };
    const p5: number[] = [];
    const p50: number[] = [];
    const p95: number[] = [];
    for (let y = 0; y < inputs.horizonYears; y++) {
      const col = allRuns.map((r) => r[y]);
      p5.push(round2(pickPercentile(col, 5)));
      p50.push(round2(pickPercentile(col, 50)));
      p95.push(round2(pickPercentile(col, 95)));
    }
    monteCarlo = {
      p5,
      p50,
      p95,
      npvP5: round2(pickPercentile(npvSamples, 5)),
      npvP50: round2(pickPercentile(npvSamples, 50)),
      npvP95: round2(pickPercentile(npvSamples, 95)),
    };
  }

  return { yearly, npvPkr, irrPct, paybackYears, monteCarlo };
}

/**
 * Rotation validator. Pure function. Returns list of warnings.
 * Principles enforced:
 *  - no same crop three years in a row
 *  - legume should follow heavy cereal at least once every 3 years
 *  - cotton not back-to-back (soil fatigue)
 */
const CEREALS = new Set(['wheat', 'rice', 'maize', 'barley', 'sorghum']);
const LEGUMES = new Set(['chickpea', 'lentil', 'mung', 'mash', 'pea', 'soybean', 'gram']);

export interface RotationWarning {
  fieldId: string;
  year: number;
  principle: string;
  message: string;
}

export function validateRotation(
  fieldId: string,
  schedule: { year: number; cropCode: string }[],
): RotationWarning[] {
  const warnings: RotationWarning[] = [];
  const sorted = [...schedule].sort((a, b) => a.year - b.year);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (i >= 2 && sorted[i - 1].cropCode === cur.cropCode && sorted[i - 2].cropCode === cur.cropCode) {
      warnings.push({
        fieldId,
        year: cur.year,
        principle: 'no_same_crop_three_years',
        message: `${cur.cropCode} planted three years running on this field`,
      });
    }
    if (i >= 1 && cur.cropCode === 'cotton' && sorted[i - 1].cropCode === 'cotton') {
      warnings.push({
        fieldId,
        year: cur.year,
        principle: 'no_cotton_back_to_back',
        message: 'Cotton planted two years in a row — soil fatigue risk',
      });
    }
  }
  const window = sorted.slice(0, Math.min(3, sorted.length));
  if (window.length >= 3 && window.every((w) => CEREALS.has(w.cropCode)) && !window.some((w) => LEGUMES.has(w.cropCode))) {
    warnings.push({
      fieldId,
      year: window[window.length - 1].year,
      principle: 'legume_break_required',
      message: 'Three cereal seasons without a legume break — nitrogen depletion risk',
    });
  }
  return warnings;
}
