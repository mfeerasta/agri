import { sql } from 'drizzle-orm';
import { db, cropPlans } from '@zameen/db';
import {
  computeYoYComparison,
  computeCostPoolTrends,
  type YoYComparison,
  type CostPoolTrend,
} from '@zameen/finance';

export interface YoYTotals {
  revenuePkr: number;
  totalCostPkr: number;
  marginPkr: number;
  acres: number;
  yieldKg: number;
  weightedMarginPerAcrePkr: number;
  weightedYieldPerAcreKg: number;
}

export interface YoYReportData {
  currentSeason: string;
  previousSeason: string;
  rows: YoYComparison[];
  totalsCurrent: YoYTotals;
  totalsPrevious: YoYTotals;
  totalsDelta: {
    revenuePct: number | null;
    costPct: number | null;
    marginPct: number | null;
    yieldPct: number | null;
  };
  costPoolTrends: CostPoolTrend[];
}

function sumTotals(rows: Array<{ revenuePkr: number; totalCostPkr: number; marginPkr: number; acres: number; yieldKg: number }>): YoYTotals {
  const t: YoYTotals = {
    revenuePkr: 0,
    totalCostPkr: 0,
    marginPkr: 0,
    acres: 0,
    yieldKg: 0,
    weightedMarginPerAcrePkr: 0,
    weightedYieldPerAcreKg: 0,
  };
  for (const r of rows) {
    t.revenuePkr += r.revenuePkr;
    t.totalCostPkr += r.totalCostPkr;
    t.marginPkr += r.marginPkr;
    t.acres += r.acres;
    t.yieldKg += r.yieldKg;
  }
  t.weightedMarginPerAcrePkr = t.acres > 0 ? Number((t.marginPkr / t.acres).toFixed(2)) : 0;
  t.weightedYieldPerAcreKg = t.acres > 0 ? Number((t.yieldKg / t.acres).toFixed(2)) : 0;
  return t;
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(2));
}

export async function buildYoYReportData(
  entityId: string,
  currentSeason: string,
  previousSeason: string,
): Promise<YoYReportData> {
  const rows = await computeYoYComparison(entityId, currentSeason, previousSeason);
  const totalsCurrent = sumTotals(rows.map((r) => r.current));
  const totalsPrevious = sumTotals(rows.filter((r) => r.previous).map((r) => r.previous!));
  const costPoolTrends = await computeCostPoolTrends(entityId, [previousSeason, currentSeason]);
  return {
    currentSeason,
    previousSeason,
    rows,
    totalsCurrent,
    totalsPrevious,
    totalsDelta: {
      revenuePct: pct(totalsCurrent.revenuePkr, totalsPrevious.revenuePkr),
      costPct: pct(totalsCurrent.totalCostPkr, totalsPrevious.totalCostPkr),
      marginPct: pct(totalsCurrent.marginPkr, totalsPrevious.marginPkr),
      yieldPct: pct(totalsCurrent.weightedYieldPerAcreKg, totalsPrevious.weightedYieldPerAcreKg),
    },
    costPoolTrends,
  };
}

export async function listSeasonLabels(): Promise<string[]> {
  const rows = await db
    .select({ seasonLabel: cropPlans.seasonLabel })
    .from(cropPlans)
    .groupBy(cropPlans.seasonLabel)
    .orderBy(sql`max(${cropPlans.createdAt}) desc`);
  return rows.map((r) => r.seasonLabel);
}
