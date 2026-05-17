'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  cropPlanCreateSchema,
  cropStageLogCreateSchema,
  harvestRecordCreateSchema,
} from '@zameen/shared/validators';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { db, cropPlans, cropStageLogs, harvestRecords, produceLots } from '@zameen/db';
import { submitApproval } from '@zameen/approvals';
import { allocateCost } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function createCropPlan(raw: unknown): Promise<Result> {
  const parsed = cropPlanCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(cropPlans)
    .values({
      fieldId: d.fieldId,
      cropProfileId: d.cropProfileId,
      season: d.season,
      seasonLabel: d.seasonLabel,
      varietyName: d.varietyName ?? null,
      plannedSowingDate: new Date(d.plannedSowingDate),
      plannedAcres: d.plannedAcres.toString(),
      expectedYieldPerAcre: d.expectedYieldPerAcre?.toString() ?? null,
      budgetPkr: d.budgetPkr.toString(),
    })
    .returning();

  const budget = Number(d.budgetPkr);
  const t = DEFAULT_APPROVAL_THRESHOLDS_PKR.feasibility_study;
  const needsApproval = budget > 0 && (t.supervisor === 0 || (t.supervisor !== null && budget > t.supervisor));
  if (needsApproval) {
    await submitApproval({
      entityId: d.entityId,
      approvalType: 'feasibility_study',
      sourceModule: 'crops',
      sourceRecordId: row!.id,
      title: `Crop plan: ${d.seasonLabel} on ${d.plannedAcres} acres`,
      amountPkr: budget,
      payload: { cropPlanId: row!.id, ...d },
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }

  revalidatePath('/crops');
  return { ok: true, id: row!.id };
}

export async function logCropStage(raw: unknown): Promise<Result> {
  const parsed = cropStageLogCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(cropStageLogs)
    .values({
      cropPlanId: d.cropPlanId,
      stage: d.stage,
      observedOn: new Date(d.observedOn),
      observedBy: ctx.userId,
      notes: [d.notes, d.notesUr].filter(Boolean).join('\n') || null,
      photoUrls: d.photoUrls,
    })
    .returning();
  await db
    .update(cropPlans)
    .set({ currentStage: d.stage, updatedAt: new Date() })
    .where(eq(cropPlans.id, d.cropPlanId));
  revalidatePath(`/crops/plans/${d.cropPlanId}`);
  return { ok: true, id: row!.id };
}

export async function logHarvest(raw: unknown): Promise<Result> {
  const parsed = harvestRecordCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;

  const [plan] = await db.select().from(cropPlans).where(eq(cropPlans.id, d.cropPlanId)).limit(1);
  if (!plan) return { ok: false, error: 'Crop plan not found' };

  const [harvest] = await db
    .insert(harvestRecords)
    .values({
      cropPlanId: d.cropPlanId,
      harvestedOn: new Date(d.harvestedOn),
      acresHarvested: d.acresHarvested.toString(),
      grossYieldKg: d.grossYieldKg.toString(),
      moisturePct: d.moisturePct?.toString() ?? null,
      laborCostPkr: d.laborCostPkr?.toString() ?? null,
      machineryCostPkr: d.machineryCostPkr?.toString() ?? null,
      notes: d.notes ?? null,
    })
    .returning();

  const [lot] = await db
    .insert(produceLots)
    .values({
      entityId: d.entityId,
      cropPlanId: d.cropPlanId,
      fieldId: plan.fieldId,
      harvestRecordId: harvest!.id,
      lotNumber: d.lotNumber,
      cropName: plan.varietyName ?? 'unknown',
      grade: d.grade,
      moisturePct: d.moisturePct?.toString() ?? null,
      netWeightKg: d.grossYieldKg.toString(),
      storageLocationId: d.storageLocationId ?? null,
      receivedOn: new Date(d.harvestedOn),
    })
    .returning();

  if (d.laborCostPkr && d.laborCostPkr > 0) {
    await allocateCost({
      entityId: d.entityId,
      sourceModule: 'labor',
      sourceRecordId: harvest!.id,
      fieldId: plan.fieldId,
      cropPlanId: plan.id,
      costPool: 'labor_field',
      amountPkr: d.laborCostPkr,
      allocatedOn: d.harvestedOn.slice(0, 10),
    });
  }
  if (d.machineryCostPkr && d.machineryCostPkr > 0) {
    await allocateCost({
      entityId: d.entityId,
      sourceModule: 'other',
      sourceRecordId: harvest!.id,
      fieldId: plan.fieldId,
      cropPlanId: plan.id,
      costPool: 'repairs',
      amountPkr: d.machineryCostPkr,
      allocatedOn: d.harvestedOn.slice(0, 10),
    });
  }

  await db
    .update(cropPlans)
    .set({ currentStage: 'harvest', updatedAt: new Date() })
    .where(eq(cropPlans.id, d.cropPlanId));

  revalidatePath(`/crops/plans/${d.cropPlanId}`);
  return { ok: true, id: lot!.id };
}
