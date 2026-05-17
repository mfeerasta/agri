import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, seedDb } from '@zameen/db';
import { computeCashFlowForecast } from '../cash-flow-forecast.js';

const ENTITY = 'entity-1';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

beforeEach(() => {
  resetDb();
});

describe('computeCashFlowForecast', () => {
  it('rolls inflows minus outflows and emits a below-floor warning when cash dips', async () => {
    const today = new Date();
    const day3 = isoDay(addDays(today, 3));
    const day10 = isoDay(addDays(today, 10));

    seedDb({
      entitySettings: [
        {
          entityId: ENTITY,
          unitsConfig: { cashFloorPkr: 200_000 },
        },
      ],
      // No cash accounts seeded so opening balance is 0.
      accounts: [],
      // Big outflow on day 3 — should drive running below zero / below floor.
      purchaseInvoices: [
        {
          id: 'pi-1',
          entityId: ENTITY,
          status: 'open',
          dueDate: day3,
          totalPkr: '500000',
          paidPkr: '0',
        },
      ],
      payrollRuns: [
        { id: 'pr-1', entityId: ENTITY, periodEnd: day10, totalPkr: '50000' },
      ],
      tasks: [],
      mandiDispatches: [],
      mandiSettlements: [],
    });

    const forecast = await computeCashFlowForecast({ entityId: ENTITY, horizonDays: 15 });
    expect(forecast.entityId).toBe(ENTITY);
    expect(forecast.rows).toHaveLength(15);

    // Outflow on day 3 should be 500_000.
    const r3 = forecast.rows.find((r) => r.date === day3)!;
    expect(r3.outflowPkr).toBe(500_000);

    // After day 3, balance is -500_000 — below zero warning required.
    expect(forecast.warnings.some((w) => w.reason === 'below_zero')).toBe(true);

    // Day 10 has the payroll outflow.
    const r10 = forecast.rows.find((r) => r.date === day10)!;
    expect(r10.outflowPkr).toBe(50_000);

    // Running balance is monotonically: 0 then -500k thereafter, minus 50k on day10.
    expect(r10.runningBalancePkr).toBe(-550_000);
  });
});
