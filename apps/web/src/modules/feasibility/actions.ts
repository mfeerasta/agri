'use server';

/**
 * Server actions for the pre-season what-if planner.
 * Tables: zameen.feasibility_plans + zameen.feasibility_plan_scenarios.
 * Distinct from the Director-approved feasibility_studies module under /feasibilities.
 */

import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { db, feasibilityPlans, feasibilityPlanScenarios, cropProfiles, marketPrices } from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import { computeScenario, type FeasibilityCostBreakdown } from './calc';

type Result<T = { id: string }> = { ok: true; data: T } | { ok: false; error: string };

export interface CreateStudyInput {
  entityId: string;
  name: string;
  season?: string;
}

export async function createStudy(input: CreateStudyInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name.trim()) return { ok: false, error: 'Name required' };
  const entityId = input.entityId || ctx.entityId;
  if (!entityId) return { ok: false, error: 'Entity required' };

  const [row] = await db
    .insert(feasibilityPlans)
    .values({
      entityId,
      name: input.name.trim(),
      season: input.season?.trim() || null,
      createdBy: ctx.userId,
    })
    .returning();

  revalidatePath('/app/crops/feasibility');
  return { ok: true, data: { id: row!.id } };
}

export interface AddScenarioInput {
  studyId: string;
  name: string;
  cropCode: string;
  fieldIds: string[];
  totalAcres: number;
  yieldPerAcreKg: number;
  pricePerKgPkr: number;
  costBreakdown: FeasibilityCostBreakdown;
  notes?: string;
  seasonDurationMonths?: number;
}

export async function addScenario(input: AddScenarioInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name.trim()) return { ok: false, error: 'Scenario name required' };
  if (!input.cropCode) return { ok: false, error: 'Crop required' };

  const [plan] = await db
    .select()
    .from(feasibilityPlans)
    .where(eq(feasibilityPlans.id, input.studyId))
    .limit(1);
  if (!plan) return { ok: false, error: 'Study not found' };
  if (plan.entityId !== ctx.entityId) return { ok: false, error: 'Forbidden' };

  const c = computeScenario({
    totalAcres: input.totalAcres,
    yieldPerAcreKg: input.yieldPerAcreKg,
    pricePerKgPkr: input.pricePerKgPkr,
    costBreakdown: input.costBreakdown,
    seasonDurationMonths: input.seasonDurationMonths,
  });

  const [row] = await db
    .insert(feasibilityPlanScenarios)
    .values({
      planId: input.studyId,
      name: input.name.trim(),
      cropCode: input.cropCode,
      fieldIds: input.fieldIds,
      totalAcres: String(input.totalAcres),
      yieldPerAcreKg: String(input.yieldPerAcreKg),
      pricePerKgPkr: String(input.pricePerKgPkr),
      costBreakdown: input.costBreakdown,
      revenuePkr: String(c.revenuePkr),
      totalCostPkr: String(c.totalCostPkr),
      netPkr: String(c.netPkr),
      netPerAcrePkr: String(c.netPerAcrePkr),
      irrPct: c.irrPct != null ? String(c.irrPct) : null,
      paybackMonths: c.paybackMonths != null ? String(c.paybackMonths) : null,
      notes: input.notes ?? null,
    })
    .returning();

  await db
    .update(feasibilityPlans)
    .set({ updatedAt: new Date() })
    .where(eq(feasibilityPlans.id, input.studyId));

  revalidatePath(`/app/crops/feasibility/${input.studyId}`);
  return { ok: true, data: { id: row!.id } };
}

export async function listStudies(opts: { entityId?: string } = {}) {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const entityId = opts.entityId ?? ctx.entityId;
  if (!entityId) return [];
  return db
    .select()
    .from(feasibilityPlans)
    .where(eq(feasibilityPlans.entityId, entityId))
    .orderBy(desc(feasibilityPlans.createdAt))
    .limit(100);
}

export async function loadStudy(studyId: string) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const [study] = await db
    .select()
    .from(feasibilityPlans)
    .where(and(eq(feasibilityPlans.id, studyId), eq(feasibilityPlans.entityId, ctx.entityId)))
    .limit(1);
  if (!study) return null;
  const scenarios = await db
    .select()
    .from(feasibilityPlanScenarios)
    .where(eq(feasibilityPlanScenarios.planId, studyId))
    .orderBy(feasibilityPlanScenarios.createdAt);
  return { study, scenarios };
}

export async function deleteScenario(id: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .select({ planId: feasibilityPlanScenarios.planId })
    .from(feasibilityPlanScenarios)
    .where(eq(feasibilityPlanScenarios.id, id))
    .limit(1);
  if (!row) return { ok: false, error: 'Not found' };
  await db.delete(feasibilityPlanScenarios).where(eq(feasibilityPlanScenarios.id, id));
  revalidatePath(`/app/crops/feasibility/${row.planId}`);
  return { ok: true, data: { id } };
}

export async function duplicateScenario(id: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [src] = await db
    .select()
    .from(feasibilityPlanScenarios)
    .where(eq(feasibilityPlanScenarios.id, id))
    .limit(1);
  if (!src) return { ok: false, error: 'Scenario not found' };

  const [row] = await db
    .insert(feasibilityPlanScenarios)
    .values({
      planId: src.planId,
      name: `${src.name} (copy)`,
      cropCode: src.cropCode,
      fieldIds: src.fieldIds,
      totalAcres: src.totalAcres,
      yieldPerAcreKg: src.yieldPerAcreKg,
      pricePerKgPkr: src.pricePerKgPkr,
      costBreakdown: src.costBreakdown,
      revenuePkr: src.revenuePkr,
      totalCostPkr: src.totalCostPkr,
      netPkr: src.netPkr,
      netPerAcrePkr: src.netPerAcrePkr,
      irrPct: src.irrPct,
      paybackMonths: src.paybackMonths,
      notes: src.notes,
    })
    .returning();

  revalidatePath(`/app/crops/feasibility/${src.planId}`);
  return { ok: true, data: { id: row!.id } };
}

export interface CropPrefill {
  code: string;
  name: string;
  recommendedYieldKgPerAcre: number | null;
  defaultCostBreakdown: FeasibilityCostBreakdown;
  latestMandiPricePkrPerKg: number | null;
}

export async function listCropPrefills(): Promise<CropPrefill[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const profiles = await db.select().from(cropProfiles);
  const prices = await db.select().from(marketPrices).orderBy(desc(marketPrices.recordedOn)).limit(500);
  const priceByCommodity = new Map<string, number>();
  for (const p of prices) {
    const key = p.commodity.toLowerCase();
    if (priceByCommodity.has(key)) continue;
    const mode = p.modePkr ?? p.maxPkr ?? p.minPkr;
    if (mode == null) continue;
    priceByCommodity.set(key, Number(mode));
  }

  return profiles.map((p) => ({
    code: p.code,
    name: p.name,
    recommendedYieldKgPerAcre: p.recommendedYieldKgPerAcre != null ? Number(p.recommendedYieldKgPerAcre) : null,
    defaultCostBreakdown: (p.defaultCostBreakdown ?? {}) as FeasibilityCostBreakdown,
    latestMandiPricePkrPerKg:
      priceByCommodity.get(p.code.toLowerCase()) ?? priceByCommodity.get(p.name.toLowerCase()) ?? null,
  }));
}
