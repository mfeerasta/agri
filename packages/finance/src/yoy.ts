import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  cropPlans,
  cropProfiles,
  fields as fieldsTable,
  blocks as blocksTable,
  farms as farmsTable,
  harvestRecords,
  mandiSettlements,
  mandiDispatches,
  costAllocations,
} from '@zameen/db';

/**
 * Year-on-year and multi-season aggregation helpers for the Zameen platform.
 *
 * Notes on design:
 * - Seasons are identified by free-text `season_label` (e.g. "Rabi 2025-26").
 *   We treat them as opaque tags and never try to parse a calendar year out
 *   of them. Sort order is the order returned by `seasonLabels` input.
 * - All money in PKR. Aggregation happens server-side via SQL where possible.
 * - Trend direction comes from a simple least-squares slope on margin/acre.
 */

export interface SeasonSummary {
  seasonLabel: string;
  startsOn: Date;
  endsOn: Date;
  acres: number;
  yieldKg: number;
  yieldPerAcreKg: number;
  revenuePkr: number;
  totalCostPkr: number;
  marginPkr: number;
  marginPerAcrePkr: number;
  costPerAcrePkr: number;
  cropName: string;
}

export interface YoYComparison {
  cropName: string;
  current: SeasonSummary;
  previous: SeasonSummary | null;
  yieldDeltaPct: number | null;
  costDeltaPct: number | null;
  marginDeltaPct: number | null;
  yieldVsBenchmarkPct: number;
}

export interface FieldRollingTrend {
  fieldId: string;
  fieldCode: string;
  perSeason: Array<{
    seasonLabel: string;
    cropName: string;
    yieldPerAcre: number;
    marginPerAcre: number;
  }>;
  yearsTracked: number;
  bestSeason: string;
  worstSeason: string;
  trendDirection: 'improving' | 'declining' | 'flat';
}

export interface CostPoolTrend {
  costPool: string;
  perSeason: Array<{ seasonLabel: string; totalPkr: number; perAcrePkr: number }>;
  cagr: number;
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(2));
}

/** One summary row per (season, crop). */
export async function computeSeasonSummary(
  entityId: string,
  seasonLabel: string,
): Promise<SeasonSummary[]> {
  const planRows = await db
    .select({
      id: cropPlans.id,
      acres: cropPlans.plannedAcres,
      cropProfileId: cropPlans.cropProfileId,
      sowing: cropPlans.actualSowingDate,
      plannedSowing: cropPlans.plannedSowingDate,
      harvest: cropPlans.plannedHarvestDate,
    })
    .from(cropPlans)
    .innerJoin(fieldsTable, eq(fieldsTable.id, cropPlans.fieldId))
    .innerJoin(blocksTable, eq(blocksTable.id, fieldsTable.blockId))
    .innerJoin(farmsTable, eq(farmsTable.id, blocksTable.farmId))
    .where(and(eq(cropPlans.seasonLabel, seasonLabel), eq(farmsTable.entityId, entityId)));

  if (planRows.length === 0) return [];

  const planIds = planRows.map((p) => p.id);
  const profileIds = Array.from(new Set(planRows.map((p) => p.cropProfileId)));
  const profiles = await db
    .select()
    .from(cropProfiles)
    .where(inArray(cropProfiles.id, profileIds));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const costRows = await db
    .select({
      cropPlanId: costAllocations.cropPlanId,
      total: sql<string>`coalesce(sum(${costAllocations.amountPkr}), 0)`,
    })
    .from(costAllocations)
    .where(inArray(costAllocations.cropPlanId, planIds))
    .groupBy(costAllocations.cropPlanId);
  const costByPlan = new Map<string, number>(
    costRows.map((r) => [r.cropPlanId as string, num(r.total)]),
  );

  const harvestRows = await db
    .select({
      cropPlanId: harvestRecords.cropPlanId,
      yieldKg: sql<string>`coalesce(sum(${harvestRecords.grossYieldKg}), 0)`,
    })
    .from(harvestRecords)
    .where(inArray(harvestRecords.cropPlanId, planIds))
    .groupBy(harvestRecords.cropPlanId);
  const yieldByPlan = new Map<string, number>(
    harvestRows.map((r) => [r.cropPlanId, num(r.yieldKg)]),
  );

  // Revenue: mandi_settlements link via mandi_dispatches.produce_lot,
  // which links back to crop_plans through produce_lots. For now we mirror
  // the field-pnl convention and join settlements via approval_request_id
  // matching crop_plan id when present, then fall back to a direct
  // approval_request match.
  const revRows = await db
    .select({
      cropPlanId: mandiSettlements.approvalRequestId,
      net: sql<string>`coalesce(sum(${mandiSettlements.netReceivedPkr}), 0)`,
    })
    .from(mandiSettlements)
    .innerJoin(mandiDispatches, eq(mandiDispatches.id, mandiSettlements.mandiDispatchId))
    .where(inArray(mandiSettlements.approvalRequestId, planIds))
    .groupBy(mandiSettlements.approvalRequestId);
  const revByPlan = new Map<string, number>(
    revRows.map((r) => [r.cropPlanId as string, num(r.net)]),
  );

  // Group by crop name.
  const byCrop = new Map<string, SeasonSummary>();
  for (const p of planRows) {
    const profile = profileById.get(p.cropProfileId);
    const cropName = profile?.name ?? 'Unknown';
    const acres = num(p.acres);
    const yieldKg = yieldByPlan.get(p.id) ?? 0;
    const totalCostPkr = costByPlan.get(p.id) ?? 0;
    const revenuePkr = revByPlan.get(p.id) ?? 0;
    const existing = byCrop.get(cropName) ?? {
      seasonLabel,
      startsOn: p.actualSowingDate ?? p.plannedSowingDate ?? new Date(),
      endsOn: p.harvest ?? new Date(),
      acres: 0,
      yieldKg: 0,
      yieldPerAcreKg: 0,
      revenuePkr: 0,
      totalCostPkr: 0,
      marginPkr: 0,
      marginPerAcrePkr: 0,
      costPerAcrePkr: 0,
      cropName,
    } satisfies SeasonSummary;
    existing.acres += acres;
    existing.yieldKg += yieldKg;
    existing.revenuePkr += revenuePkr;
    existing.totalCostPkr += totalCostPkr;
    byCrop.set(cropName, existing);
  }

  for (const s of byCrop.values()) {
    s.marginPkr = Number((s.revenuePkr - s.totalCostPkr).toFixed(2));
    s.yieldPerAcreKg = s.acres > 0 ? Number((s.yieldKg / s.acres).toFixed(2)) : 0;
    s.marginPerAcrePkr = s.acres > 0 ? Number((s.marginPkr / s.acres).toFixed(2)) : 0;
    s.costPerAcrePkr = s.acres > 0 ? Number((s.totalCostPkr / s.acres).toFixed(2)) : 0;
    s.acres = Number(s.acres.toFixed(4));
    s.yieldKg = Number(s.yieldKg.toFixed(2));
    s.revenuePkr = Number(s.revenuePkr.toFixed(2));
    s.totalCostPkr = Number(s.totalCostPkr.toFixed(2));
  }

  return Array.from(byCrop.values()).sort((a, b) => a.cropName.localeCompare(b.cropName));
}

export async function computeYoYComparison(
  entityId: string,
  currentSeason: string,
  previousSeason: string,
): Promise<YoYComparison[]> {
  const [currentRows, prevRows] = await Promise.all([
    computeSeasonSummary(entityId, currentSeason),
    computeSeasonSummary(entityId, previousSeason),
  ]);

  const prevByCrop = new Map(prevRows.map((r) => [r.cropName, r]));

  // Benchmarks per crop from cropProfiles.yieldBenchmarkPerAcre.
  const profiles = await db.select().from(cropProfiles);
  const benchmarkByCrop = new Map<string, number>();
  for (const p of profiles) {
    if (p.yieldBenchmarkPerAcre) benchmarkByCrop.set(p.name, Number(p.yieldBenchmarkPerAcre));
  }

  const out: YoYComparison[] = [];
  for (const curr of currentRows) {
    const prev = prevByCrop.get(curr.cropName) ?? null;
    const bench = benchmarkByCrop.get(curr.cropName) ?? 0;
    out.push({
      cropName: curr.cropName,
      current: curr,
      previous: prev,
      yieldDeltaPct: prev ? pct(curr.yieldPerAcreKg, prev.yieldPerAcreKg) : null,
      costDeltaPct: prev ? pct(curr.costPerAcrePkr, prev.costPerAcrePkr) : null,
      marginDeltaPct: prev ? pct(curr.marginPerAcrePkr, prev.marginPerAcrePkr) : null,
      yieldVsBenchmarkPct:
        bench > 0 ? Number((((curr.yieldPerAcreKg - bench) / bench) * 100).toFixed(2)) : 0,
    });
  }
  // Include crops that appeared previously but not now.
  for (const prev of prevRows) {
    if (!currentRows.find((c) => c.cropName === prev.cropName)) {
      out.push({
        cropName: prev.cropName,
        current: { ...prev, seasonLabel: currentSeason, acres: 0, yieldKg: 0, revenuePkr: 0, totalCostPkr: 0, marginPkr: 0, marginPerAcrePkr: 0, costPerAcrePkr: 0, yieldPerAcreKg: 0 },
        previous: prev,
        yieldDeltaPct: null,
        costDeltaPct: null,
        marginDeltaPct: null,
        yieldVsBenchmarkPct: 0,
      });
    }
  }
  return out.sort((a, b) => a.cropName.localeCompare(b.cropName));
}

export async function computeFieldRollingTrend(
  entityId: string,
  fieldId: string,
  years: number,
): Promise<FieldRollingTrend> {
  const [field] = await db
    .select({ id: fieldsTable.id, code: fieldsTable.code })
    .from(fieldsTable)
    .where(eq(fieldsTable.id, fieldId))
    .limit(1);
  if (!field) {
    return {
      fieldId,
      fieldCode: fieldId.slice(0, 8),
      perSeason: [],
      yearsTracked: 0,
      bestSeason: '',
      worstSeason: '',
      trendDirection: 'flat',
    };
  }

  void entityId; // entity scope is enforced by the field belonging to the entity in calling pages.

  const plans = await db
    .select({
      id: cropPlans.id,
      seasonLabel: cropPlans.seasonLabel,
      cropProfileId: cropPlans.cropProfileId,
      acres: cropPlans.plannedAcres,
      createdAt: cropPlans.createdAt,
    })
    .from(cropPlans)
    .where(eq(cropPlans.fieldId, fieldId))
    .orderBy(cropPlans.createdAt);

  if (plans.length === 0) {
    return {
      fieldId: field.id,
      fieldCode: field.code,
      perSeason: [],
      yearsTracked: 0,
      bestSeason: '',
      worstSeason: '',
      trendDirection: 'flat',
    };
  }

  const planIds = plans.map((p) => p.id);
  const [profiles, costRows, harvestRows, revRows] = await Promise.all([
    db.select().from(cropProfiles).where(inArray(cropProfiles.id, Array.from(new Set(plans.map((p) => p.cropProfileId))))),
    db
      .select({
        cropPlanId: costAllocations.cropPlanId,
        total: sql<string>`coalesce(sum(${costAllocations.amountPkr}), 0)`,
      })
      .from(costAllocations)
      .where(inArray(costAllocations.cropPlanId, planIds))
      .groupBy(costAllocations.cropPlanId),
    db
      .select({
        cropPlanId: harvestRecords.cropPlanId,
        yieldKg: sql<string>`coalesce(sum(${harvestRecords.grossYieldKg}), 0)`,
      })
      .from(harvestRecords)
      .where(inArray(harvestRecords.cropPlanId, planIds))
      .groupBy(harvestRecords.cropPlanId),
    db
      .select({
        cropPlanId: mandiSettlements.approvalRequestId,
        net: sql<string>`coalesce(sum(${mandiSettlements.netReceivedPkr}), 0)`,
      })
      .from(mandiSettlements)
      .where(inArray(mandiSettlements.approvalRequestId, planIds))
      .groupBy(mandiSettlements.approvalRequestId),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const costByPlan = new Map(costRows.map((r) => [r.cropPlanId as string, num(r.total)]));
  const yieldByPlan = new Map(harvestRows.map((r) => [r.cropPlanId, num(r.yieldKg)]));
  const revByPlan = new Map(revRows.map((r) => [r.cropPlanId as string, num(r.net)]));

  const perSeason = plans.map((p) => {
    const acres = num(p.acres);
    const cost = costByPlan.get(p.id) ?? 0;
    const rev = revByPlan.get(p.id) ?? 0;
    const yieldKg = yieldByPlan.get(p.id) ?? 0;
    const margin = rev - cost;
    return {
      seasonLabel: p.seasonLabel,
      cropName: profileById.get(p.cropProfileId)?.name ?? 'Unknown',
      yieldPerAcre: acres > 0 ? Number((yieldKg / acres).toFixed(2)) : 0,
      marginPerAcre: acres > 0 ? Number((margin / acres).toFixed(2)) : 0,
    };
  });

  const limited = perSeason.slice(-years);

  // Trend direction = sign of slope of margin/acre over its index.
  let direction: 'improving' | 'declining' | 'flat' = 'flat';
  if (limited.length >= 2) {
    const n = limited.length;
    const xs = limited.map((_, i) => i);
    const ys = limited.map((s) => s.marginPerAcre);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num1 = 0;
    let den = 0;
    for (let i = 0; i < n; i += 1) {
      num1 += (xs[i]! - meanX) * (ys[i]! - meanY);
      den += (xs[i]! - meanX) ** 2;
    }
    const slope = den === 0 ? 0 : num1 / den;
    const tol = Math.max(1, Math.abs(meanY) * 0.02);
    if (slope > tol) direction = 'improving';
    else if (slope < -tol) direction = 'declining';
  }

  const sortedByMargin = [...limited].sort((a, b) => b.marginPerAcre - a.marginPerAcre);
  const bestSeason = sortedByMargin[0]?.seasonLabel ?? '';
  const worstSeason = sortedByMargin[sortedByMargin.length - 1]?.seasonLabel ?? '';

  return {
    fieldId: field.id,
    fieldCode: field.code,
    perSeason: limited,
    yearsTracked: limited.length,
    bestSeason,
    worstSeason,
    trendDirection: direction,
  };
}

export async function computeCostPoolTrends(
  entityId: string,
  seasonLabels: string[],
): Promise<CostPoolTrend[]> {
  if (seasonLabels.length === 0) return [];
  const allPlans = await db
    .select({
      id: cropPlans.id,
      seasonLabel: cropPlans.seasonLabel,
      acres: cropPlans.plannedAcres,
    })
    .from(cropPlans)
    .innerJoin(fieldsTable, eq(fieldsTable.id, cropPlans.fieldId))
    .innerJoin(blocksTable, eq(blocksTable.id, fieldsTable.blockId))
    .innerJoin(farmsTable, eq(farmsTable.id, blocksTable.farmId))
    .where(and(inArray(cropPlans.seasonLabel, seasonLabels), eq(farmsTable.entityId, entityId)));

  const planIds = allPlans.map((p) => p.id);
  if (planIds.length === 0) return [];

  const acresBySeason = new Map<string, number>();
  const planSeason = new Map<string, string>();
  for (const p of allPlans) {
    acresBySeason.set(p.seasonLabel, (acresBySeason.get(p.seasonLabel) ?? 0) + num(p.acres));
    planSeason.set(p.id, p.seasonLabel);
  }

  const allocRows = await db
    .select({
      cropPlanId: costAllocations.cropPlanId,
      costPool: costAllocations.costPool,
      total: sql<string>`coalesce(sum(${costAllocations.amountPkr}), 0)`,
    })
    .from(costAllocations)
    .where(inArray(costAllocations.cropPlanId, planIds))
    .groupBy(costAllocations.cropPlanId, costAllocations.costPool);

  // pool -> season -> total
  const buckets = new Map<string, Map<string, number>>();
  for (const r of allocRows) {
    const season = r.cropPlanId ? planSeason.get(r.cropPlanId) : undefined;
    if (!season) continue;
    const pool = r.costPool;
    if (!buckets.has(pool)) buckets.set(pool, new Map());
    const m = buckets.get(pool)!;
    m.set(season, (m.get(season) ?? 0) + num(r.total));
  }

  const trends: CostPoolTrend[] = [];
  for (const [pool, m] of buckets.entries()) {
    const perSeason = seasonLabels.map((s) => {
      const total = m.get(s) ?? 0;
      const acres = acresBySeason.get(s) ?? 0;
      return {
        seasonLabel: s,
        totalPkr: Number(total.toFixed(2)),
        perAcrePkr: acres > 0 ? Number((total / acres).toFixed(2)) : 0,
      };
    });
    const first = perSeason[0]?.totalPkr ?? 0;
    const last = perSeason[perSeason.length - 1]?.totalPkr ?? 0;
    const periods = Math.max(1, perSeason.length - 1);
    const cagr =
      first > 0 ? Number(((Math.pow(last / first, 1 / periods) - 1) * 100).toFixed(2)) : 0;
    trends.push({ costPool: pool, perSeason, cagr });
  }

  return trends.sort((a, b) => a.costPool.localeCompare(b.costPool));
}
