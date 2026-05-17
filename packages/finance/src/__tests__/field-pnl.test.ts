import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, seedDb } from '@zameen/db';
import { computeFieldPnL } from '../field-pnl.js';

const PLAN_ID = 'plan-1';
const FIELD_ID = 'field-1';

beforeEach(() => {
  resetDb();
  seedDb({
    cropPlans: [
      {
        id: PLAN_ID,
        fieldId: FIELD_ID,
        varietyName: 'Wheat-Rabi25',
        plannedAcres: '10',
      },
    ],
    costAllocations: [
      { id: 'c1', cropPlanId: PLAN_ID, costPool: 'seed', amountPkr: '50000' },
      { id: 'c2', cropPlanId: PLAN_ID, costPool: 'fertilizer', amountPkr: '120000' },
      { id: 'c3', cropPlanId: PLAN_ID, costPool: 'diesel', amountPkr: '30000' },
      { id: 'c4', cropPlanId: PLAN_ID, costPool: 'seed', amountPkr: '10000' },
    ],
    harvestRecords: [
      { id: 'h1', cropPlanId: PLAN_ID, grossYieldKg: '12000' },
      { id: 'h2', cropPlanId: PLAN_ID, grossYieldKg: '3000' },
    ],
    // field-pnl filters mandi settlements by `approvalRequestId === cropPlanId`.
    // We seed that field accordingly so the revenue path exercises.
    mandiSettlements: [
      { id: 'm1', approvalRequestId: PLAN_ID, netReceivedPkr: '400000' },
      { id: 'm2', approvalRequestId: PLAN_ID, netReceivedPkr: '100000' },
    ],
  });
});

describe('computeFieldPnL', () => {
  it('aggregates costs by pool, totals revenue and yield, computes per-acre margin', async () => {
    const pnl = await computeFieldPnL(PLAN_ID);
    expect(pnl).not.toBeNull();
    expect(pnl!.fieldId).toBe(FIELD_ID);
    expect(pnl!.cropName).toBe('Wheat-Rabi25');
    expect(pnl!.acres).toBe(10);
    expect(pnl!.revenuePkr).toBe(500_000);
    expect(pnl!.costByPool.seed).toBe(60_000);
    expect(pnl!.costByPool.fertilizer).toBe(120_000);
    expect(pnl!.costByPool.diesel).toBe(30_000);
    expect(pnl!.totalCostPkr).toBe(210_000);
    expect(pnl!.grossMarginPkr).toBe(290_000);
    expect(pnl!.marginPerAcrePkr).toBe(29_000);
    expect(pnl!.yieldKg).toBe(15_000);
    expect(pnl!.yieldPerAcreKg).toBe(1_500);
  });

  it('returns null when crop plan does not exist', async () => {
    const pnl = await computeFieldPnL('missing-plan');
    expect(pnl).toBeNull();
  });
});
