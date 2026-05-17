import { and, eq, sql } from 'drizzle-orm';
import { db, costAllocations, harvestRecords, mandiSettlements, cropPlans } from '@zameen/db';
import type { CostPool } from '@zameen/shared';

export interface FieldPnL {
  fieldId: string;
  cropPlanId: string;
  cropName: string;
  acres: number;
  revenuePkr: number;
  costByPool: Record<CostPool, number>;
  totalCostPkr: number;
  grossMarginPkr: number;
  marginPerAcrePkr: number;
  yieldKg: number;
  yieldPerAcreKg: number;
}

/**
 * Field-level P&L for a crop plan. Pulls every cost allocation tagged
 * to the plan and every harvest/settlement revenue tagged to it.
 *
 * The killer report: after season close, MF can see F3-Wheat-Rabi25
 * delivered Rs. X/acre vs F7 at Rs. Y/acre, with cost breakdown.
 */
export async function computeFieldPnL(cropPlanId: string): Promise<FieldPnL | null> {
  const [plan] = await db.select().from(cropPlans).where(eq(cropPlans.id, cropPlanId)).limit(1);
  if (!plan) return null;

  const allocs = await db
    .select({
      costPool: costAllocations.costPool,
      total: sql<string>`coalesce(sum(${costAllocations.amountPkr}), 0)`,
    })
    .from(costAllocations)
    .where(eq(costAllocations.cropPlanId, cropPlanId))
    .groupBy(costAllocations.costPool);

  const costByPool = {} as Record<CostPool, number>;
  let totalCostPkr = 0;
  for (const a of allocs) {
    const amt = Number(a.total);
    costByPool[a.costPool as CostPool] = (costByPool[a.costPool as CostPool] ?? 0) + amt;
    totalCostPkr += amt;
  }

  const harvests = await db.select().from(harvestRecords).where(eq(harvestRecords.cropPlanId, cropPlanId));
  const yieldKg = harvests.reduce((s, h) => s + Number(h.grossYieldKg), 0);

  const mandiRevenue = await db
    .select({ total: sql<string>`coalesce(sum(${mandiSettlements.netReceivedPkr}), 0)` })
    .from(mandiSettlements)
    .where(and(eq(mandiSettlements.approvalRequestId, cropPlanId)));
  const revenuePkr = Number(mandiRevenue[0]?.total ?? 0);

  const acres = Number(plan.plannedAcres);
  const grossMarginPkr = Number((revenuePkr - totalCostPkr).toFixed(2));

  return {
    fieldId: plan.fieldId,
    cropPlanId: plan.id,
    cropName: plan.varietyName ?? '',
    acres,
    revenuePkr,
    costByPool,
    totalCostPkr: Number(totalCostPkr.toFixed(2)),
    grossMarginPkr,
    marginPerAcrePkr: acres > 0 ? Number((grossMarginPkr / acres).toFixed(2)) : 0,
    yieldKg: Number(yieldKg.toFixed(2)),
    yieldPerAcreKg: acres > 0 ? Number((yieldKg / acres).toFixed(2)) : 0,
  };
}
