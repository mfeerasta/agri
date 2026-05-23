'use server';

/**
 * Server actions for processing recipes, runs, and byproduct disposition.
 * Tables: zameen.processing_recipes, .processing_runs, .byproduct_inventory.
 */

import { revalidatePath } from 'next/cache';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  db,
  processingRecipes,
  processingRuns,
  byproductInventory,
  type ProcessKind,
  type RecipeInputSpec,
  type RecipeOutputSpec,
  type RecipeByproductSpec,
  type RunInputUsed,
  type RunOutputProduced,
} from '@zameen/db';
import { executeRun, type ExecuteRunResult } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = { ok: true; data: T } | { ok: false; error: string };

export interface CreateRecipeInput {
  name: string;
  processKind: ProcessKind;
  inputs: RecipeInputSpec[];
  outputs: RecipeOutputSpec[];
  byproducts?: RecipeByproductSpec[];
  energyKwhPerUnit?: number;
  labourMinutesPerUnit?: number;
  expectedTotalYieldPct?: number;
  notes?: string;
}

export async function createRecipe(input: CreateRecipeInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name.trim()) return { ok: false, error: 'Name required' };
  if (input.inputs.length === 0) return { ok: false, error: 'At least one input required' };
  if (input.outputs.length === 0) return { ok: false, error: 'At least one output required' };

  const [row] = await db
    .insert(processingRecipes)
    .values({
      entityId: ctx.entityId,
      name: input.name.trim(),
      processKind: input.processKind,
      inputs: input.inputs,
      outputs: input.outputs,
      byproducts: input.byproducts ?? null,
      energyKwhPerUnit: input.energyKwhPerUnit?.toString() ?? null,
      labourMinutesPerUnit: input.labourMinutesPerUnit?.toString() ?? null,
      expectedTotalYieldPct: input.expectedTotalYieldPct?.toString() ?? null,
      notes: input.notes?.trim() || null,
    })
    .returning({ id: processingRecipes.id });

  revalidatePath('/app/processing/recipes');
  return { ok: true, data: { id: row!.id } };
}

export async function listRecipes() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(processingRecipes)
    .where(and(eq(processingRecipes.entityId, ctx.entityId), eq(processingRecipes.isActive, true)))
    .orderBy(desc(processingRecipes.createdAt))
    .limit(200);
}

export async function loadRecipe(recipeId: string) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const [row] = await db
    .select()
    .from(processingRecipes)
    .where(and(eq(processingRecipes.id, recipeId), eq(processingRecipes.entityId, ctx.entityId)))
    .limit(1);
  return row ?? null;
}

export interface RecordRunInput {
  recipeId: string;
  startedAt: string;
  endedAt?: string;
  inputs: RunInputUsed[];
  outputs: RunOutputProduced[];
  byproducts?: Array<{
    kind: string;
    quantityKg: number;
    unitValuePkr?: number;
    storageLocationId?: string;
  }>;
  energyKwh?: number;
  energyRatePkrPerKwh?: number;
  labourMinutes?: number;
  labourRatePkrPerHour?: number;
  overheadPkr?: number;
  notes?: string;
}

export async function recordRun(input: RecordRunInput): Promise<Result<ExecuteRunResult>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (input.inputs.length === 0) return { ok: false, error: 'No inputs supplied' };
  if (input.outputs.length === 0) return { ok: false, error: 'No outputs supplied' };

  try {
    const result = await executeRun({
      recipeId: input.recipeId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      inputs: input.inputs,
      outputs: input.outputs,
      byproducts: input.byproducts,
      energyKwh: input.energyKwh,
      energyRatePkrPerKwh: input.energyRatePkrPerKwh,
      labourMinutes: input.labourMinutes,
      labourRatePkrPerHour: input.labourRatePkrPerHour,
      overheadPkr: input.overheadPkr,
      operatorId: ctx.userId,
      notes: input.notes,
    });
    revalidatePath('/app/processing/runs');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Run failed' };
  }
}

export async function listRuns(limit = 100) {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(processingRuns)
    .where(eq(processingRuns.entityId, ctx.entityId))
    .orderBy(desc(processingRuns.startedAt))
    .limit(limit);
}

export async function loadRun(runId: string) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const [run] = await db
    .select()
    .from(processingRuns)
    .where(and(eq(processingRuns.id, runId), eq(processingRuns.entityId, ctx.entityId)))
    .limit(1);
  if (!run) return null;
  const [recipe] = await db
    .select()
    .from(processingRecipes)
    .where(eq(processingRecipes.id, run.recipeId))
    .limit(1);
  const byproducts = await db
    .select()
    .from(byproductInventory)
    .where(eq(byproductInventory.processingRunId, runId));
  return { run, recipe: recipe ?? null, byproducts };
}

export async function listOpenByproducts() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  // Pull byproducts whose disposed_on is null, scoped to entity via the parent run.
  return db
    .select({
      id: byproductInventory.id,
      runId: byproductInventory.processingRunId,
      byproductKind: byproductInventory.byproductKind,
      quantityKg: byproductInventory.quantityKg,
      unitValuePkr: byproductInventory.unitValuePkr,
      disposalKind: byproductInventory.disposalKind,
      proceedsPkr: byproductInventory.proceedsPkr,
      createdAt: byproductInventory.createdAt,
      runStartedAt: processingRuns.startedAt,
    })
    .from(byproductInventory)
    .innerJoin(processingRuns, eq(byproductInventory.processingRunId, processingRuns.id))
    .where(and(eq(processingRuns.entityId, ctx.entityId), isNull(byproductInventory.disposedOn)))
    .orderBy(desc(byproductInventory.createdAt))
    .limit(200);
}

export interface DisposeByproductInput {
  byproductId: string;
  disposalKind: 'sold' | 'fed_livestock' | 'composted' | 'given_away' | 'disposed';
  disposedOn: string;
  proceedsPkr?: number;
}

export async function disposeByproduct(input: DisposeByproductInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .update(byproductInventory)
    .set({
      disposalKind: input.disposalKind,
      disposedOn: input.disposedOn,
      proceedsPkr: input.proceedsPkr?.toString() ?? null,
    })
    .where(eq(byproductInventory.id, input.byproductId))
    .returning({ id: byproductInventory.id });

  if (!row) return { ok: false, error: 'Byproduct not found' };
  revalidatePath('/app/processing/byproducts');
  return { ok: true, data: { id: row.id } };
}
