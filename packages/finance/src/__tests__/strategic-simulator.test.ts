import { describe, it, expect } from 'vitest';
import { runScenario, validateRotation, type ScenarioInputs } from '../strategic-simulator.js';

const baseInputs: ScenarioInputs = {
  baseYear: 2026,
  horizonYears: 5,
  discountRatePct: 15,
  weatherRiskPct: 0,
  inflationPct: 0,
  fixedOpexPerYearPkr: 0,
  fieldYearAssumptions: Array.from({ length: 5 }, (_, i) => ({
    fieldId: 'agg',
    year: 2026 + i,
    cropCode: 'wheat',
    acres: 1,
    yieldPerAcreKg: 10_000_000,
    yieldVariancePct: 0,
    pricePerKgPkr: 1,
    priceVariancePct: 0,
    opexPerAcrePkr: 6_000_000,
  })),
  capexItems: [],
};

describe('runScenario', () => {
  it('produces a yearly P&L with correct length', () => {
    const out = runScenario(baseInputs);
    expect(out.yearly).toHaveLength(5);
    expect(out.yearly[0].revenuePkr).toBe(10_000_000);
    expect(out.yearly[0].opexPkr).toBe(6_000_000);
  });

  it('computes positive NPV when net cash flow positive', () => {
    const out = runScenario(baseInputs);
    expect(out.npvPkr).toBeGreaterThan(0);
  });

  it('penalises capex without financing in NPV', () => {
    const withCapex = {
      ...baseInputs,
      capexItems: [
        { name: 'tractor', year: 2026, amountPkr: 3_000_000, usefulLifeYears: 10, financedPct: 0, loanRatePct: 0, loanTermYears: 0 },
      ],
    };
    const baseline = runScenario(baseInputs);
    const stressed = runScenario(withCapex);
    expect(stressed.npvPkr).toBeLessThan(baseline.npvPkr);
  });

  it('runs Monte Carlo when iterations provided', () => {
    const out = runScenario({ ...baseInputs, weatherRiskPct: 10, monteCarloIterations: 200 });
    expect(out.monteCarlo).toBeDefined();
    expect(out.monteCarlo!.p5).toHaveLength(5);
    expect(out.monteCarlo!.npvP5).toBeLessThanOrEqual(out.monteCarlo!.npvP95);
  });
});

describe('validateRotation', () => {
  it('flags same crop three years in a row', () => {
    const warnings = validateRotation('f1', [
      { year: 2026, cropCode: 'wheat' },
      { year: 2027, cropCode: 'wheat' },
      { year: 2028, cropCode: 'wheat' },
    ]);
    expect(warnings.some((w) => w.principle === 'no_same_crop_three_years')).toBe(true);
  });

  it('flags cotton back-to-back', () => {
    const warnings = validateRotation('f1', [
      { year: 2026, cropCode: 'cotton' },
      { year: 2027, cropCode: 'cotton' },
    ]);
    expect(warnings.some((w) => w.principle === 'no_cotton_back_to_back')).toBe(true);
  });

  it('flags cereal-only first 3 years', () => {
    const warnings = validateRotation('f1', [
      { year: 2026, cropCode: 'wheat' },
      { year: 2027, cropCode: 'maize' },
      { year: 2028, cropCode: 'rice' },
    ]);
    expect(warnings.some((w) => w.principle === 'legume_break_required')).toBe(true);
  });

  it('accepts a legume in rotation', () => {
    const warnings = validateRotation('f1', [
      { year: 2026, cropCode: 'wheat' },
      { year: 2027, cropCode: 'chickpea' },
      { year: 2028, cropCode: 'cotton' },
    ]);
    expect(warnings).toHaveLength(0);
  });
});
