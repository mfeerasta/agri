/**
 * Inventory forecasting engine.
 *
 * Reads consumption history from inputIssuances and stock state from
 * inputPurchases. Produces velocity, days-until-stockout, EOQ-style
 * reorder recommendations, and statistical anomaly flags.
 *
 * Quantities are in the input's native unit (kg, L, bag) as declared in
 * zameen.inputs.unit. Prices are PKR.
 */

import { and, between, eq, gte, lte, sql as dsql } from 'drizzle-orm';
import {
  db,
  inputs,
  inputPurchases,
  inputIssuances,
  inventoryForecasts,
  inventoryAnomalies,
  reorderRules,
} from '@zameen/db';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export interface UsageVelocity {
  inputId: string;
  lookbackDays: number;
  totalIssuedQty: number;
  daysWithUsage: number;
  meanDaily: number;
  stdDev: number;
  sampleSize: number;
}

/**
 * Average daily consumption over a lookback window. Days with zero issuance
 * are included in the denominator so velocity reflects real-world daily draw,
 * not just the days something was issued.
 */
export async function computeUsageVelocity({
  inputId,
  lookbackDays = 90,
}: {
  inputId: string;
  lookbackDays?: number;
}): Promise<UsageVelocity> {
  const today = new Date();
  const start = addDays(today, -lookbackDays);
  const rows = await db
    .select({ issuedOn: inputIssuances.issuedOn, qty: inputIssuances.quantity })
    .from(inputIssuances)
    .where(
      and(
        eq(inputIssuances.inputId, inputId),
        between(inputIssuances.issuedOn, start, today),
      ),
    );

  const dayBuckets = new Map<string, number>();
  for (let i = 0; i < lookbackDays; i++) {
    dayBuckets.set(isoDay(addDays(start, i)), 0);
  }
  let total = 0;
  for (const r of rows) {
    const issued = r.issuedOn instanceof Date ? r.issuedOn : new Date(r.issuedOn);
    const day = isoDay(issued);
    const qty = Number(r.qty);
    total += qty;
    dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + qty);
  }
  const series = Array.from(dayBuckets.values());
  const n = series.length;
  const mean = n > 0 ? total / n : 0;
  let variance = 0;
  for (const v of series) variance += (v - mean) ** 2;
  variance = n > 1 ? variance / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const daysWithUsage = series.filter((v) => v > 0).length;

  return {
    inputId,
    lookbackDays,
    totalIssuedQty: total,
    daysWithUsage,
    meanDaily: mean,
    stdDev,
    sampleSize: n,
  };
}

/**
 * Current on-hand stock = sum(purchases) - sum(issuances).
 * Pending purchases means orders placed but not yet received: in this
 * codebase a purchase row implies received, so pending is zero unless a
 * future-dated purchase row exists (we treat those as scheduled inflow).
 */
export async function getStockPosition({ inputId }: { inputId: string }): Promise<{
  onHand: number;
  pendingInflow: number;
  pendingByDate: Array<{ date: string; quantity: number }>;
}> {
  const today = new Date();
  const [purch] = await db
    .select({
      received: dsql<string>`COALESCE(SUM(CASE WHEN ${inputPurchases.purchasedOn} <= NOW() THEN ${inputPurchases.quantity} ELSE 0 END), 0)`,
      pending: dsql<string>`COALESCE(SUM(CASE WHEN ${inputPurchases.purchasedOn} > NOW() THEN ${inputPurchases.quantity} ELSE 0 END), 0)`,
    })
    .from(inputPurchases)
    .where(eq(inputPurchases.inputId, inputId));
  const [issued] = await db
    .select({ total: dsql<string>`COALESCE(SUM(${inputIssuances.quantity}), 0)` })
    .from(inputIssuances)
    .where(eq(inputIssuances.inputId, inputId));

  const futurePurchRows = await db
    .select({ purchasedOn: inputPurchases.purchasedOn, qty: inputPurchases.quantity })
    .from(inputPurchases)
    .where(and(eq(inputPurchases.inputId, inputId), gte(inputPurchases.purchasedOn, today)));

  const pendingByDate = futurePurchRows.map((r) => ({
    date: isoDay(r.purchasedOn instanceof Date ? r.purchasedOn : new Date(r.purchasedOn)),
    quantity: Number(r.qty),
  }));

  return {
    onHand: Number(purch?.received ?? 0) - Number(issued?.total ?? 0),
    pendingInflow: Number(purch?.pending ?? 0),
    pendingByDate,
  };
}

export interface StockoutProjection {
  inputId: string;
  currentStock: number;
  velocity: number;
  pendingInflow: number;
  safetyStockDays: number;
  daysUntilStockout: number | null;
  projectedStockoutDate: string | null;
}

/**
 * Days until stock is exhausted after subtracting a safety buffer.
 * Returns null if velocity is zero (no projected stockout).
 */
export async function forecastDaysUntilStockout({
  inputId,
  safetyStockDays = 7,
  lookbackDays = 90,
}: {
  inputId: string;
  safetyStockDays?: number;
  lookbackDays?: number;
}): Promise<StockoutProjection> {
  const v = await computeUsageVelocity({ inputId, lookbackDays });
  const pos = await getStockPosition({ inputId });
  const seasonalMult = await computeSeasonalUsage({
    inputId,
    monthOfYear: new Date().getUTCMonth() + 1,
  });
  const adjustedVelocity = v.meanDaily * seasonalMult.multiplier;

  if (adjustedVelocity <= 0) {
    return {
      inputId,
      currentStock: pos.onHand,
      velocity: adjustedVelocity,
      pendingInflow: pos.pendingInflow,
      safetyStockDays,
      daysUntilStockout: null,
      projectedStockoutDate: null,
    };
  }

  const usableStock = pos.onHand + pos.pendingInflow - adjustedVelocity * safetyStockDays;
  const days = Math.floor(usableStock / adjustedVelocity);
  const projectedDate = isoDay(addDays(new Date(), Math.max(0, days)));

  return {
    inputId,
    currentStock: pos.onHand,
    velocity: adjustedVelocity,
    pendingInflow: pos.pendingInflow,
    safetyStockDays,
    daysUntilStockout: days,
    projectedStockoutDate: projectedDate,
  };
}

export interface ReorderRecommendation {
  inputId: string;
  recommendedQuantity: number;
  recommendedByDate: string;
  expectedAnnualDemand: number;
  estimatedUnitCostPkr: number;
  rationale: string;
}

/**
 * Economic order quantity adjusted for lead time and seasonality.
 *
 * EOQ = sqrt(2 * D * K / H) where
 *   D = annual demand
 *   K = fixed ordering cost (assumed 5000 PKR per purchase event)
 *   H = annual holding cost per unit (assumed 8% of unit cost)
 *
 * If EOQ is less than demand-over-lead-time + safety stock, we bump it up.
 */
export async function recommendReorderQuantity({
  inputId,
  leadTimeDays = 14,
  safetyStockDays = 7,
}: {
  inputId: string;
  leadTimeDays?: number;
  safetyStockDays?: number;
}): Promise<ReorderRecommendation> {
  const v = await computeUsageVelocity({ inputId, lookbackDays: 180 });
  const seasonal = await computeSeasonalUsage({
    inputId,
    monthOfYear: new Date().getUTCMonth() + 1,
  });
  const dailyDemand = v.meanDaily * seasonal.multiplier;
  const annualDemand = dailyDemand * 365;

  const [lastPurch] = await db
    .select({ unitPricePkr: inputPurchases.unitPricePkr })
    .from(inputPurchases)
    .where(eq(inputPurchases.inputId, inputId))
    .orderBy(dsql`${inputPurchases.purchasedOn} desc`)
    .limit(1);
  const unitCost = Number(lastPurch?.unitPricePkr ?? 0);

  const orderingCost = 5000;
  const holdingCostPerUnit = unitCost * 0.08;
  let eoq = 0;
  if (annualDemand > 0 && holdingCostPerUnit > 0) {
    eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
  }
  const leadTimeDemand = dailyDemand * leadTimeDays + dailyDemand * safetyStockDays;
  const recommendedQty = Number(Math.max(eoq, leadTimeDemand).toFixed(2));

  const stock = await getStockPosition({ inputId });
  const daysOfCover = dailyDemand > 0 ? stock.onHand / dailyDemand : Infinity;
  const fireBy = Math.max(0, Math.floor(daysOfCover - leadTimeDays - safetyStockDays));
  const recommendedByDate = isoDay(addDays(new Date(), fireBy));

  const rationale =
    `Daily demand ${dailyDemand.toFixed(2)} (seasonal x${seasonal.multiplier.toFixed(2)}), ` +
    `EOQ ${eoq.toFixed(0)}, lead-time+safety draw ${leadTimeDemand.toFixed(0)}.`;

  return {
    inputId,
    recommendedQuantity: recommendedQty,
    recommendedByDate,
    expectedAnnualDemand: Number(annualDemand.toFixed(2)),
    estimatedUnitCostPkr: unitCost,
    rationale,
  };
}

export interface AnomalousDay {
  date: string;
  observedQuantity: number;
  expectedQuantity: number;
  stdDevAway: number;
  kind: 'unusual_high_usage' | 'unusual_low_usage';
}

/**
 * Flag days where consumption exceeds mean + 3*sigma (high) or where a
 * normally-high-usage day shows zero against a non-zero baseline (low).
 *
 * The 3-sigma high threshold is the theft/leak/error indicator. The
 * low-usage check catches missed log entries on days when the input is
 * normally consumed (>50% of historical days had usage).
 */
export async function detectAnomalousUsage({
  inputId,
  fromDate,
  toDate,
  lookbackDays = 90,
}: {
  inputId: string;
  fromDate: string;
  toDate: string;
  lookbackDays?: number;
}): Promise<AnomalousDay[]> {
  const baseline = await computeUsageVelocity({ inputId, lookbackDays });
  if (baseline.sampleSize < 14 || baseline.stdDev === 0) return [];

  const rows = await db
    .select({ issuedOn: inputIssuances.issuedOn, qty: inputIssuances.quantity })
    .from(inputIssuances)
    .where(
      and(
        eq(inputIssuances.inputId, inputId),
        between(inputIssuances.issuedOn, new Date(fromDate), new Date(`${toDate}T23:59:59Z`)),
      ),
    );

  const byDay = new Map<string, number>();
  const from = new Date(fromDate);
  const to = new Date(toDate);
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    byDay.set(isoDay(d), 0);
  }
  for (const r of rows) {
    const issued = r.issuedOn instanceof Date ? r.issuedOn : new Date(r.issuedOn);
    const day = isoDay(issued);
    byDay.set(day, (byDay.get(day) ?? 0) + Number(r.qty));
  }

  const highCutoff = baseline.meanDaily + 3 * baseline.stdDev;
  const usageDayRate = baseline.daysWithUsage / baseline.sampleSize;
  const out: AnomalousDay[] = [];
  for (const [day, qty] of byDay.entries()) {
    if (qty > highCutoff && qty > 0) {
      out.push({
        date: day,
        observedQuantity: qty,
        expectedQuantity: Number(baseline.meanDaily.toFixed(4)),
        stdDevAway: Number(((qty - baseline.meanDaily) / baseline.stdDev).toFixed(2)),
        kind: 'unusual_high_usage',
      });
    } else if (qty === 0 && usageDayRate > 0.5 && baseline.meanDaily > 0) {
      out.push({
        date: day,
        observedQuantity: 0,
        expectedQuantity: Number(baseline.meanDaily.toFixed(4)),
        stdDevAway: Number((-baseline.meanDaily / baseline.stdDev).toFixed(2)),
        kind: 'unusual_low_usage',
      });
    }
  }
  return out;
}

export interface SeasonalUsage {
  inputId: string;
  monthOfYear: number;
  multiplier: number;
  monthMean: number;
  overallMean: number;
  sampleMonths: number;
}

/**
 * Multiplier of monthly mean vs overall mean, computed from up to 3 prior
 * years of inputIssuances. Returns 1.0 when sample is too thin.
 *
 * Many inputs are seasonal (fertilizer surge Oct/Mar planting, pesticide
 * surge May-Aug). The forecast uses this multiplier to adjust daily velocity.
 */
export async function computeSeasonalUsage({
  inputId,
  monthOfYear,
}: {
  inputId: string;
  monthOfYear: number;
}): Promise<SeasonalUsage> {
  const today = new Date();
  const threeYearsAgo = addDays(today, -365 * 3);
  const rows = await db
    .select({ issuedOn: inputIssuances.issuedOn, qty: inputIssuances.quantity })
    .from(inputIssuances)
    .where(and(eq(inputIssuances.inputId, inputId), gte(inputIssuances.issuedOn, threeYearsAgo)));

  if (rows.length === 0) {
    return { inputId, monthOfYear, multiplier: 1, monthMean: 0, overallMean: 0, sampleMonths: 0 };
  }

  const monthBuckets = new Map<string, number>();
  for (const r of rows) {
    const d = r.issuedOn instanceof Date ? r.issuedOn : new Date(r.issuedOn);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + Number(r.qty));
  }

  let monthTotal = 0;
  let monthCount = 0;
  let allTotal = 0;
  for (const [k, v] of monthBuckets.entries()) {
    allTotal += v;
    const m = Number(k.split('-')[1]);
    if (m === monthOfYear) {
      monthTotal += v;
      monthCount += 1;
    }
  }
  const overallMean = allTotal / monthBuckets.size;
  const monthMean = monthCount > 0 ? monthTotal / monthCount : overallMean;
  const multiplier = overallMean > 0 && monthCount > 0 ? monthMean / overallMean : 1;

  return {
    inputId,
    monthOfYear,
    multiplier: Number(multiplier.toFixed(4)),
    monthMean: Number(monthMean.toFixed(4)),
    overallMean: Number(overallMean.toFixed(4)),
    sampleMonths: monthCount,
  };
}

export interface PersistedForecast {
  inputId: string;
  forecastId: string;
  currentStock: number;
  dailyVelocity: number;
  stdDev: number;
  daysUntilStockout: number | null;
  recommendedReorderQuantity: number;
  recommendedReorderByDate: string;
}

/**
 * Compute the full forecast for an input and persist a row in
 * inventory_forecasts. Returns the high-level numbers for the caller
 * (usually the cron runner) so it can decide whether to trigger an RFQ.
 */
export async function computeAndPersistForecast({
  inputId,
  leadTimeDays = 14,
  safetyStockDays = 7,
  horizonDays = 90,
}: {
  inputId: string;
  leadTimeDays?: number;
  safetyStockDays?: number;
  horizonDays?: number;
}): Promise<PersistedForecast> {
  const velocity = await computeUsageVelocity({ inputId, lookbackDays: 90 });
  const projection = await forecastDaysUntilStockout({ inputId, safetyStockDays });
  const reorder = await recommendReorderQuantity({ inputId, leadTimeDays, safetyStockDays });
  const seasonal = await computeSeasonalUsage({
    inputId,
    monthOfYear: new Date().getUTCMonth() + 1,
  });

  const payload = {
    velocity,
    projection,
    reorder,
    seasonal,
    horizonDays,
    leadTimeDays,
    safetyStockDays,
  };

  const [row] = await db
    .insert(inventoryForecasts)
    .values({
      inputId,
      currentStock: projection.currentStock.toString(),
      dailyVelocity: projection.velocity.toString(),
      stdDev: velocity.stdDev.toString(),
      daysUntilStockout: projection.daysUntilStockout,
      recommendedReorderQuantity: reorder.recommendedQuantity.toString(),
      recommendedReorderByDate: reorder.recommendedByDate,
      forecastHorizonDays: horizonDays,
      forecastPayload: payload,
    })
    .returning({ id: inventoryForecasts.id });

  return {
    inputId,
    forecastId: row!.id,
    currentStock: projection.currentStock,
    dailyVelocity: projection.velocity,
    stdDev: velocity.stdDev,
    daysUntilStockout: projection.daysUntilStockout,
    recommendedReorderQuantity: reorder.recommendedQuantity,
    recommendedReorderByDate: reorder.recommendedByDate,
  };
}

/**
 * Persist a detected anomaly. De-duplicates on (inputId, detectedOn, kind).
 */
export async function recordAnomaly(args: {
  inputId: string;
  detectedOn: string;
  observedQuantity: number;
  expectedQuantity: number;
  stdDevAway: number;
  kind: AnomalousDay['kind'] | 'stockout' | 'expired_unused' | 'batch_mismatch' | 'reconciliation_variance';
}): Promise<void> {
  const existing = await db
    .select({ id: inventoryAnomalies.id })
    .from(inventoryAnomalies)
    .where(
      and(
        eq(inventoryAnomalies.inputId, args.inputId),
        eq(inventoryAnomalies.detectedOn, args.detectedOn),
        eq(inventoryAnomalies.anomalyKind, args.kind),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(inventoryAnomalies).values({
    inputId: args.inputId,
    detectedOn: args.detectedOn,
    observedQuantity: args.observedQuantity.toString(),
    expectedQuantity: args.expectedQuantity.toString(),
    stdDevAway: args.stdDevAway.toString(),
    anomalyKind: args.kind,
  });
}

/**
 * Active reorder rules for an input. Returns null if none.
 */
export async function getActiveReorderRule(inputId: string) {
  const [rule] = await db
    .select()
    .from(reorderRules)
    .where(and(eq(reorderRules.inputId, inputId), eq(reorderRules.isActive, true)))
    .limit(1);
  return rule ?? null;
}

/**
 * Projected outflows for cash-flow forecasting. Returns rows the
 * cash-flow-forecast module can fold into its 30/60/90 day buckets.
 */
export async function projectedReorderOutflows({
  entityId,
  horizonDays = 90,
}: {
  entityId: string;
  horizonDays?: number;
}): Promise<Array<{ date: string; inputId: string; amountPkr: number }>> {
  const entityInputs = await db
    .select({ id: inputs.id })
    .from(inputs)
    .where(eq(inputs.entityId, entityId));

  const today = new Date();
  const horizonEnd = addDays(today, horizonDays);
  const out: Array<{ date: string; inputId: string; amountPkr: number }> = [];

  for (const inp of entityInputs) {
    const rule = await getActiveReorderRule(inp.id);
    if (!rule) continue;
    const reco = await recommendReorderQuantity({
      inputId: inp.id,
      safetyStockDays: rule.safetyStockDays,
    });
    const dueDate = new Date(reco.recommendedByDate);
    if (dueDate < today || dueDate > horizonEnd) continue;
    const amount = reco.recommendedQuantity * reco.estimatedUnitCostPkr;
    if (amount <= 0) continue;
    out.push({
      date: reco.recommendedByDate,
      inputId: inp.id,
      amountPkr: Number(amount.toFixed(2)),
    });
  }
  return out;
}

export const __test = { isoDay, addDays, DAY_MS };
