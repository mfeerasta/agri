/**
 * Asset lifecycle cost analytics. Aggregates depreciation, repairs,
 * preventive maintenance, and fuel into a single per-asset rollup and
 * computes cost-per-operating-hour benchmarks against an industry table.
 *
 * Pure read-side: no journal posting here; the underlying allocations
 * are already in place via @zameen/finance/cost-allocation.
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  assets,
  costAllocations,
  dieselDailyLogs,
  maintenanceExecutions,
  repairWorkOrders,
  repairRequests,
} from '@zameen/db';

export interface LifecycleCostSummary {
  assetId: string;
  assetCode: string;
  purchasePricePkr: number;
  bookValuePkr: number;
  totalHoursRun: number;
  depreciationPkr: number;
  maintenancePkr: number;
  repairsPkr: number;
  fuelPkr: number;
  totalCostPkr: number;
  costPerHourPkr: number;
  benchmarkCostPerHourPkr: number | null;
  benchmarkDeltaPct: number | null;
  replaceVsRepairFlag: boolean;
}

export interface MonthlyCostPoint {
  month: string; // YYYY-MM
  depreciationPkr: number;
  maintenancePkr: number;
  repairsPkr: number;
  fuelPkr: number;
}

// Reference cost-per-hour-of-operation (PKR) for major tractor models
// in Pakistan operating conditions. Update when fresh benchmarks land.
export const INDUSTRY_BENCHMARK_COST_PER_HOUR_PKR: Record<string, number> = {
  'massey_ferguson_240': 1850,
  'massey_ferguson_375': 2350,
  'fiat_480': 2050,
  'new_holland_65_56': 2400,
};

function benchmarkKey(make: string | null, model: string | null): string | null {
  if (!make || !model) return null;
  const k = `${make}_${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (INDUSTRY_BENCHMARK_COST_PER_HOUR_PKR[k] !== undefined) return k;
  // fuzzy: massey-ferguson 375 etc
  for (const key of Object.keys(INDUSTRY_BENCHMARK_COST_PER_HOUR_PKR)) {
    if (k.includes(key)) return key;
  }
  return null;
}

export async function computeLifecycleCost(assetId: string): Promise<LifecycleCostSummary> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  const totalHoursRun = Number(asset.currentHourMeter ?? 0);
  const purchasePricePkr = Number(asset.purchasePricePkr ?? 0);
  const bookValuePkr = Number(asset.currentBookValuePkr ?? purchasePricePkr);
  const depreciationPkr = Math.max(0, purchasePricePkr - bookValuePkr);

  const [maintAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${maintenanceExecutions.totalCostPkr}), 0)` })
    .from(maintenanceExecutions)
    .where(eq(maintenanceExecutions.assetId, assetId));
  const maintenancePkr = Number(maintAgg?.total ?? 0);

  const [repairAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${repairWorkOrders.finalInvoicePkr}), 0)` })
    .from(repairWorkOrders)
    .innerJoin(repairRequests, eq(repairRequests.id, repairWorkOrders.repairRequestId))
    .where(eq(repairRequests.assetId, assetId));
  const repairsPkr = Number(repairAgg?.total ?? 0);

  const [fuelAgg] = await db
    .select({ total: sql<string>`coalesce(sum(${dieselDailyLogs.totalCostPkr}), 0)` })
    .from(dieselDailyLogs)
    .where(eq(dieselDailyLogs.assetId, assetId));
  const fuelPkr = Number(fuelAgg?.total ?? 0);

  const totalCostPkr = depreciationPkr + maintenancePkr + repairsPkr + fuelPkr;
  const costPerHourPkr = totalHoursRun > 0 ? Number((totalCostPkr / totalHoursRun).toFixed(2)) : 0;

  const benchKey = benchmarkKey(asset.make, asset.model);
  const benchmarkCostPerHourPkr = benchKey ? INDUSTRY_BENCHMARK_COST_PER_HOUR_PKR[benchKey]! : null;
  const benchmarkDeltaPct =
    benchmarkCostPerHourPkr && benchmarkCostPerHourPkr > 0 && costPerHourPkr > 0
      ? Number((((costPerHourPkr - benchmarkCostPerHourPkr) / benchmarkCostPerHourPkr) * 100).toFixed(1))
      : null;

  // Replace vs repair heuristic: trailing 12 months maintenance > 30% of book value.
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const isoCutoff = twelveMonthsAgo.toISOString().slice(0, 10);
  const [trailingMaint] = await db
    .select({ total: sql<string>`coalesce(sum(${maintenanceExecutions.totalCostPkr}), 0)` })
    .from(maintenanceExecutions)
    .where(and(eq(maintenanceExecutions.assetId, assetId), gte(maintenanceExecutions.executedOn, isoCutoff)));
  const trailing = Number(trailingMaint?.total ?? 0);
  const replaceVsRepairFlag = bookValuePkr > 0 && trailing > bookValuePkr * 0.3;

  return {
    assetId,
    assetCode: asset.code,
    purchasePricePkr,
    bookValuePkr,
    totalHoursRun,
    depreciationPkr,
    maintenancePkr,
    repairsPkr,
    fuelPkr,
    totalCostPkr,
    costPerHourPkr,
    benchmarkCostPerHourPkr,
    benchmarkDeltaPct,
    replaceVsRepairFlag,
  };
}

export async function monthlyCostTrend(assetId: string, months = 12): Promise<MonthlyCostPoint[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const iso = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      month: sql<string>`to_char(${costAllocations.allocatedOn}, 'YYYY-MM')`,
      pool: costAllocations.costPool,
      total: sql<string>`coalesce(sum(${costAllocations.amountPkr}), 0)`,
    })
    .from(costAllocations)
    .where(and(eq(costAllocations.assetId, assetId), gte(costAllocations.allocatedOn, iso)))
    .groupBy(sql`1, 2`)
    .orderBy(desc(sql`1`));

  const byMonth = new Map<string, MonthlyCostPoint>();
  for (const r of rows) {
    const m = r.month;
    const entry =
      byMonth.get(m) ??
      { month: m, depreciationPkr: 0, maintenancePkr: 0, repairsPkr: 0, fuelPkr: 0 };
    const amt = Number(r.total);
    if (r.pool === 'depreciation') entry.depreciationPkr += amt;
    else if (r.pool === 'asset_maintenance') entry.maintenancePkr += amt;
    else if (r.pool === 'repairs') entry.repairsPkr += amt;
    else if (r.pool === 'diesel') entry.fuelPkr += amt;
    byMonth.set(m, entry);
  }
  return Array.from(byMonth.values());
}
