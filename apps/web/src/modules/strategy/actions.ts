'use server';

/**
 * Server actions for strategic planning + 5-year roadmap + scenario simulator.
 * Tables: zameen.strategic_plans, .strategic_initiatives, .crop_rotation_plans,
 * .scenario_simulations.
 */

import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import {
  db,
  strategicPlans,
  strategicInitiatives,
  cropRotationPlans,
  scenarioSimulations,
  type RotationScheduleEntry,
} from '@zameen/db';
import { runScenario, validateRotation, type ScenarioInputs } from '@zameen/finance';
import { submitApproval } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = { ok: true; data: T } | { ok: false; error: string };

export interface CreatePlanInput {
  entityId?: string;
  name: string;
  horizonYears?: number;
  startYear: number;
  visionStatement?: string;
}

export async function createStrategicPlan(input: CreatePlanInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name.trim()) return { ok: false, error: 'Name required' };
  const entityId = input.entityId || ctx.entityId;
  if (!entityId) return { ok: false, error: 'Entity required' };

  const [row] = await db
    .insert(strategicPlans)
    .values({
      entityId,
      name: input.name.trim(),
      horizonYears: input.horizonYears ?? 5,
      startYear: input.startYear,
      createdBy: ctx.userId,
      visionStatement: input.visionStatement?.trim() || null,
      status: 'draft',
    })
    .returning();

  revalidatePath('/app/strategy');
  return { ok: true, data: { id: row!.id } };
}

export async function listStrategicPlans() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(strategicPlans)
    .where(eq(strategicPlans.entityId, ctx.entityId))
    .orderBy(desc(strategicPlans.createdAt))
    .limit(100);
}

export async function loadStrategicPlan(planId: string) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const [plan] = await db
    .select()
    .from(strategicPlans)
    .where(and(eq(strategicPlans.id, planId), eq(strategicPlans.entityId, ctx.entityId)))
    .limit(1);
  if (!plan) return null;
  const initiatives = await db
    .select()
    .from(strategicInitiatives)
    .where(eq(strategicInitiatives.planId, planId))
    .orderBy(strategicInitiatives.startYear, strategicInitiatives.priority);
  const rotations = await db
    .select()
    .from(cropRotationPlans)
    .where(eq(cropRotationPlans.planId, planId));
  const simulations = await db
    .select()
    .from(scenarioSimulations)
    .where(eq(scenarioSimulations.planId, planId))
    .orderBy(desc(scenarioSimulations.createdAt))
    .limit(50);
  return { plan, initiatives, rotations, simulations };
}

export interface ProposeInitiativeInput {
  planId: string;
  name: string;
  category:
    | 'crop_rotation'
    | 'capex'
    | 'expansion'
    | 'diversification'
    | 'technology'
    | 'sustainability'
    | 'market_development'
    | 'workforce'
    | 'financial'
    | 'other';
  startYear: number;
  endYear: number;
  estimatedInvestmentPkr?: number;
  expectedReturnPkr?: number;
  expectedIrrPct?: number;
  paybackYears?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  riskFactors?: { factor: string; severity: string }[];
  notes?: string;
}

export async function proposeInitiative(input: ProposeInitiativeInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name.trim()) return { ok: false, error: 'Name required' };
  if (input.endYear < input.startYear) return { ok: false, error: 'End year before start year' };

  const [plan] = await db
    .select()
    .from(strategicPlans)
    .where(eq(strategicPlans.id, input.planId))
    .limit(1);
  if (!plan) return { ok: false, error: 'Plan not found' };
  if (plan.entityId !== ctx.entityId) return { ok: false, error: 'Forbidden' };

  const [row] = await db
    .insert(strategicInitiatives)
    .values({
      planId: input.planId,
      name: input.name.trim(),
      category: input.category,
      startYear: input.startYear,
      endYear: input.endYear,
      estimatedInvestmentPkr:
        input.estimatedInvestmentPkr != null ? String(input.estimatedInvestmentPkr) : null,
      expectedReturnPkr: input.expectedReturnPkr != null ? String(input.expectedReturnPkr) : null,
      expectedIrrPct: input.expectedIrrPct != null ? String(input.expectedIrrPct) : null,
      paybackYears: input.paybackYears != null ? String(input.paybackYears) : null,
      priority: input.priority,
      riskFactors: input.riskFactors ?? [],
      status: 'proposed',
      notes: input.notes ?? null,
    })
    .returning();

  // Strategic initiatives always go through Director per
  // DEFAULT_APPROVAL_THRESHOLDS_PKR.strategic_initiative.
  const approval = await submitApproval({
    entityId: ctx.entityId,
    approvalType: 'strategic_initiative',
    sourceModule: 'strategy',
    sourceRecordId: row!.id,
    title: `${input.name} (${input.category})`,
    amountPkr: input.estimatedInvestmentPkr ?? 0,
    payload: {
      initiativeId: row!.id,
      planId: input.planId,
      category: input.category,
      startYear: input.startYear,
      endYear: input.endYear,
    },
    contextSnapshot: {
      planName: plan.name,
      horizonYears: plan.horizonYears,
      estimatedInvestmentPkr: input.estimatedInvestmentPkr ?? 0,
      expectedReturnPkr: input.expectedReturnPkr ?? 0,
      expectedIrrPct: input.expectedIrrPct ?? null,
      paybackYears: input.paybackYears ?? null,
      priority: input.priority,
      riskFactors: input.riskFactors ?? [],
    },
    requestedBy: ctx.userId,
  });

  await db
    .update(strategicInitiatives)
    .set({ approvalRequestId: approval.id })
    .where(eq(strategicInitiatives.id, row!.id));

  revalidatePath(`/app/strategy/${input.planId}`);
  return { ok: true, data: { id: row!.id } };
}

export interface UpsertRotationInput {
  planId: string;
  fieldId: string;
  rotationSchedule: RotationScheduleEntry[];
  rotationKind?: 'two_year' | 'three_year' | 'four_year' | 'custom';
  rotationPrinciples?: string[];
  expectedSoilImpact?: string;
}

export async function upsertCropRotation(input: UpsertRotationInput): Promise<Result & { warnings?: string[] }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [plan] = await db
    .select()
    .from(strategicPlans)
    .where(eq(strategicPlans.id, input.planId))
    .limit(1);
  if (!plan || plan.entityId !== ctx.entityId) return { ok: false, error: 'Plan not found' };

  const warnings = validateRotation(input.fieldId, input.rotationSchedule);

  const [existing] = await db
    .select()
    .from(cropRotationPlans)
    .where(and(eq(cropRotationPlans.planId, input.planId), eq(cropRotationPlans.fieldId, input.fieldId)))
    .limit(1);

  let id: string;
  if (existing) {
    await db
      .update(cropRotationPlans)
      .set({
        rotationSchedule: input.rotationSchedule,
        rotationKind: input.rotationKind ?? existing.rotationKind ?? 'custom',
        rotationPrinciples: input.rotationPrinciples ?? existing.rotationPrinciples ?? [],
        expectedSoilImpact: input.expectedSoilImpact ?? existing.expectedSoilImpact ?? null,
      })
      .where(eq(cropRotationPlans.id, existing.id));
    id = existing.id;
  } else {
    const [row] = await db
      .insert(cropRotationPlans)
      .values({
        planId: input.planId,
        fieldId: input.fieldId,
        rotationSchedule: input.rotationSchedule,
        rotationKind: input.rotationKind ?? 'custom',
        rotationPrinciples: input.rotationPrinciples ?? [],
        expectedSoilImpact: input.expectedSoilImpact ?? null,
      })
      .returning();
    id = row!.id;
  }

  revalidatePath(`/app/strategy/${input.planId}/rotation`);
  return { ok: true, data: { id }, warnings: warnings.map((w) => w.message) };
}

export interface SimulateInput {
  planId?: string;
  scenarioName: string;
  inputs: ScenarioInputs;
}

export async function simulateScenario(input: SimulateInput): Promise<Result & { simulationId?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.scenarioName.trim()) return { ok: false, error: 'Scenario name required' };

  if (input.planId) {
    const [plan] = await db
      .select()
      .from(strategicPlans)
      .where(eq(strategicPlans.id, input.planId))
      .limit(1);
    if (!plan || plan.entityId !== ctx.entityId) return { ok: false, error: 'Plan not found' };
  }

  const result = runScenario(input.inputs);

  const [row] = await db
    .insert(scenarioSimulations)
    .values({
      planId: input.planId ?? null,
      scenarioName: input.scenarioName.trim(),
      baseYear: input.inputs.baseYear,
      horizonYears: input.inputs.horizonYears,
      inputsJsonb: input.inputs,
      outputsJsonb: result.yearly,
      netPresentValuePkr: String(result.npvPkr),
      internalRateOfReturnPct: result.irrPct != null ? String(result.irrPct) : null,
      paybackYears: result.paybackYears != null ? String(result.paybackYears) : null,
      monteCarloIterations: input.inputs.monteCarloIterations ?? null,
      monteCarloResults: result.monteCarlo ?? null,
    })
    .returning();

  if (input.planId) revalidatePath(`/app/strategy/${input.planId}/simulate`);
  return { ok: true, data: { id: row!.id }, simulationId: row!.id };
}

export async function activatePlan(planId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [plan] = await db
    .select()
    .from(strategicPlans)
    .where(eq(strategicPlans.id, planId))
    .limit(1);
  if (!plan || plan.entityId !== ctx.entityId) return { ok: false, error: 'Plan not found' };

  // Supersede any other active plans.
  await db
    .update(strategicPlans)
    .set({ status: 'superseded', updatedAt: new Date() })
    .where(and(eq(strategicPlans.entityId, ctx.entityId), eq(strategicPlans.status, 'active')));

  await db
    .update(strategicPlans)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(strategicPlans.id, planId));

  revalidatePath('/app/strategy');
  revalidatePath(`/app/strategy/${planId}`);
  return { ok: true, data: { id: planId } };
}
