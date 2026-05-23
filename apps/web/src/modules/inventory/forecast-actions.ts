'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  db,
  inputs,
  inventoryForecasts,
  inventoryAnomalies,
  reorderRules,
} from '@zameen/db';
import {
  computeAndPersistForecast,
  detectAnomalousUsage,
  recordAnomaly,
} from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export interface ForecastRow {
  inputId: string;
  inputName: string;
  inputNameUr: string | null;
  unit: string;
  currentStock: number;
  dailyVelocity: number;
  daysUntilStockout: number | null;
  recommendedReorderQuantity: number;
  recommendedReorderByDate: string | null;
  rag: 'red' | 'amber' | 'green';
  computedAt: string;
}

function ragFor(days: number | null): 'red' | 'amber' | 'green' {
  if (days == null) return 'green';
  if (days < 7) return 'red';
  if (days <= 30) return 'amber';
  return 'green';
}

export async function loadForecasts(entityId: string): Promise<ForecastRow[]> {
  const inpRows = await db
    .select({ id: inputs.id, name: inputs.name, nameUr: inputs.nameUr, unit: inputs.unit })
    .from(inputs)
    .where(and(eq(inputs.entityId, entityId), eq(inputs.isActive, true)));

  const out: ForecastRow[] = [];
  for (const i of inpRows) {
    const [f] = await db
      .select()
      .from(inventoryForecasts)
      .where(eq(inventoryForecasts.inputId, i.id))
      .orderBy(desc(inventoryForecasts.computedAt))
      .limit(1);
    if (!f) continue;
    const days = f.daysUntilStockout ?? null;
    out.push({
      inputId: i.id,
      inputName: i.name,
      inputNameUr: i.nameUr,
      unit: i.unit,
      currentStock: Number(f.currentStock),
      dailyVelocity: Number(f.dailyVelocity),
      daysUntilStockout: days,
      recommendedReorderQuantity: Number(f.recommendedReorderQuantity ?? 0),
      recommendedReorderByDate: f.recommendedReorderByDate,
      rag: ragFor(days),
      computedAt: f.computedAt instanceof Date ? f.computedAt.toISOString() : String(f.computedAt),
    });
  }
  out.sort((a, b) => {
    const aDays = a.daysUntilStockout ?? 9999;
    const bDays = b.daysUntilStockout ?? 9999;
    return aDays - bDays;
  });
  return out;
}

export async function recomputeForecast(inputId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  try {
    await computeAndPersistForecast({ inputId });
    revalidatePath('/inventory/forecasts');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ReorderRuleRow {
  id: string;
  inputId: string;
  inputName: string;
  unit: string;
  ruleKind: string;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  reviewPeriodDays: number | null;
  safetyStockDays: number;
  preferredVendorId: string | null;
  autoCreateRfq: boolean;
  isActive: boolean;
}

export async function loadReorderRules(entityId: string): Promise<ReorderRuleRow[]> {
  const rows = await db
    .select({
      id: reorderRules.id,
      inputId: reorderRules.inputId,
      ruleKind: reorderRules.ruleKind,
      reorderPoint: reorderRules.reorderPoint,
      reorderQuantity: reorderRules.reorderQuantity,
      reviewPeriodDays: reorderRules.reviewPeriodDays,
      safetyStockDays: reorderRules.safetyStockDays,
      preferredVendorId: reorderRules.preferredVendorId,
      autoCreateRfq: reorderRules.autoCreateRfq,
      isActive: reorderRules.isActive,
      inputName: inputs.name,
      unit: inputs.unit,
      inputEntityId: inputs.entityId,
    })
    .from(reorderRules)
    .innerJoin(inputs, eq(inputs.id, reorderRules.inputId))
    .where(eq(inputs.entityId, entityId));
  return rows.map((r) => ({
    id: r.id,
    inputId: r.inputId,
    inputName: r.inputName,
    unit: r.unit,
    ruleKind: r.ruleKind,
    reorderPoint: r.reorderPoint != null ? Number(r.reorderPoint) : null,
    reorderQuantity: r.reorderQuantity != null ? Number(r.reorderQuantity) : null,
    reviewPeriodDays: r.reviewPeriodDays,
    safetyStockDays: r.safetyStockDays,
    preferredVendorId: r.preferredVendorId,
    autoCreateRfq: r.autoCreateRfq,
    isActive: r.isActive,
  }));
}

export interface UpsertReorderRuleArgs {
  id?: string;
  inputId: string;
  ruleKind: 'reorder_point' | 'periodic' | 'eoq' | 'manual';
  reorderPoint?: number;
  reorderQuantity?: number;
  reviewPeriodDays?: number;
  safetyStockDays: number;
  preferredVendorId?: string;
  autoCreateRfq: boolean;
  isActive: boolean;
}

export async function upsertReorderRule(args: UpsertReorderRuleArgs): Promise<Result<{ id: string }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const values = {
    inputId: args.inputId,
    ruleKind: args.ruleKind,
    reorderPoint: args.reorderPoint != null ? args.reorderPoint.toString() : null,
    reorderQuantity: args.reorderQuantity != null ? args.reorderQuantity.toString() : null,
    reviewPeriodDays: args.reviewPeriodDays ?? null,
    safetyStockDays: args.safetyStockDays,
    preferredVendorId: args.preferredVendorId ?? null,
    autoCreateRfq: args.autoCreateRfq,
    isActive: args.isActive,
  };
  let row: { id: string } | undefined;
  if (args.id) {
    const [r] = await db
      .update(reorderRules)
      .set(values)
      .where(eq(reorderRules.id, args.id))
      .returning({ id: reorderRules.id });
    row = r;
  } else {
    const [r] = await db.insert(reorderRules).values(values).returning({ id: reorderRules.id });
    row = r;
  }
  revalidatePath('/inventory/reorder-rules');
  if (!row) return { ok: false, error: 'Failed to upsert rule' };
  return { ok: true, data: { id: row.id } };
}

export async function toggleAutoRfq(ruleId: string, enabled: boolean): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.update(reorderRules).set({ autoCreateRfq: enabled }).where(eq(reorderRules.id, ruleId));
  revalidatePath('/inventory/reorder-rules');
  return { ok: true };
}

export interface AnomalyRow {
  id: string;
  inputId: string;
  inputName: string;
  unit: string;
  detectedOn: string;
  observedQuantity: number;
  expectedQuantity: number;
  stdDevAway: number;
  anomalyKind: string;
  resolvedAt: string | null;
}

export async function loadAnomalies({
  entityId,
  includeResolved = false,
}: {
  entityId: string;
  includeResolved?: boolean;
}): Promise<AnomalyRow[]> {
  const conditions = [eq(inputs.entityId, entityId)];
  if (!includeResolved) conditions.push(isNull(inventoryAnomalies.resolvedAt));
  const rows = await db
    .select({
      id: inventoryAnomalies.id,
      inputId: inventoryAnomalies.inputId,
      inputName: inputs.name,
      unit: inputs.unit,
      detectedOn: inventoryAnomalies.detectedOn,
      observedQuantity: inventoryAnomalies.observedQuantity,
      expectedQuantity: inventoryAnomalies.expectedQuantity,
      stdDevAway: inventoryAnomalies.stdDevAway,
      anomalyKind: inventoryAnomalies.anomalyKind,
      resolvedAt: inventoryAnomalies.resolvedAt,
    })
    .from(inventoryAnomalies)
    .innerJoin(inputs, eq(inputs.id, inventoryAnomalies.inputId))
    .where(and(...conditions))
    .orderBy(desc(inventoryAnomalies.detectedOn));
  return rows.map((r) => ({
    id: r.id,
    inputId: r.inputId,
    inputName: r.inputName,
    unit: r.unit,
    detectedOn: r.detectedOn,
    observedQuantity: Number(r.observedQuantity),
    expectedQuantity: Number(r.expectedQuantity),
    stdDevAway: Number(r.stdDevAway),
    anomalyKind: r.anomalyKind,
    resolvedAt: r.resolvedAt instanceof Date ? r.resolvedAt.toISOString() : r.resolvedAt ? String(r.resolvedAt) : null,
  }));
}

export async function resolveAnomaly({
  anomalyId,
  notes,
}: {
  anomalyId: string;
  notes: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(inventoryAnomalies)
    .set({ resolvedAt: new Date(), resolvedBy: ctx.userId, resolutionNotes: notes })
    .where(eq(inventoryAnomalies.id, anomalyId));
  revalidatePath('/inventory/anomalies');
  return { ok: true };
}

export interface InventoryHubSummary {
  belowReorderPointCount: number;
  stockoutRiskWithin7Count: number;
  openAnomaliesCount: number;
}

export async function loadInventoryHubSummary(entityId: string): Promise<InventoryHubSummary> {
  const rows = await loadForecasts(entityId);
  const rules = await loadReorderRules(entityId);
  const ruleByInput = new Map(rules.map((r) => [r.inputId, r]));
  let belowReorder = 0;
  let riskSoon = 0;
  for (const r of rows) {
    const rule = ruleByInput.get(r.inputId);
    if (rule?.reorderPoint != null && r.currentStock <= rule.reorderPoint) belowReorder += 1;
    if (r.daysUntilStockout != null && r.daysUntilStockout <= 7) riskSoon += 1;
  }
  const [anomalyCount] = await db
    .select({ c: sql<string>`count(*)` })
    .from(inventoryAnomalies)
    .innerJoin(inputs, eq(inputs.id, inventoryAnomalies.inputId))
    .where(and(eq(inputs.entityId, entityId), isNull(inventoryAnomalies.resolvedAt)));
  return {
    belowReorderPointCount: belowReorder,
    stockoutRiskWithin7Count: riskSoon,
    openAnomaliesCount: Number(anomalyCount?.c ?? 0),
  };
}

export async function scanAnomaliesForInput({
  inputId,
  fromDate,
  toDate,
}: {
  inputId: string;
  fromDate: string;
  toDate: string;
}): Promise<Result<{ flagged: number }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const anomalies = await detectAnomalousUsage({ inputId, fromDate, toDate });
  for (const a of anomalies) {
    await recordAnomaly({
      inputId,
      detectedOn: a.date,
      observedQuantity: a.observedQuantity,
      expectedQuantity: a.expectedQuantity,
      stdDevAway: a.stdDevAway,
      kind: a.kind,
    });
  }
  revalidatePath('/inventory/anomalies');
  return { ok: true, data: { flagged: anomalies.length } };
}
