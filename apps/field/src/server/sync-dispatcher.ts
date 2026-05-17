/**
 * Field-PWA sync dispatcher.
 *
 * Maps a queued client operation onto the same engines used by the web app
 * (drizzle + @zameen/approvals + @zameen/finance + shared validators), so the
 * behaviour is identical regardless of which front-end submits.
 *
 * Do not import server actions from @zameen/web. The dispatcher owns its own
 * insert + side-effect chain so the field app remains independently deployable.
 */
import { eq } from 'drizzle-orm';
import {
  db,
  dieselPurchases,
  dieselDailyLogs,
  harvestRecords,
  produceLots,
  cropPlans,
  inputs,
  inputIssuances,
  repairRequests,
  milkRecords,
  feedRecords,
  healthEvents,
  attendanceRecords,
  taskCompletions,
} from '@zameen/db';
import { submitApproval } from '@zameen/approvals';
import { allocateCost } from '@zameen/finance';
import {
  DEFAULT_APPROVAL_THRESHOLDS_PKR,
  type CostPool,
} from '@zameen/shared';
import {
  dieselPurchaseSchema,
  dieselDailyLogSchema,
  harvestRecordCreateSchema,
  inputIssuanceSchema,
  repairRequestSchema,
  milkRecordSchema,
  feedRecordSchema,
  healthEventSchema,
} from '@zameen/shared/validators';
import { z } from 'zod';

export interface DispatchContext {
  userId: string;
  entityId: string;
  role: 'worker' | 'supervisor' | 'farm_manager' | 'director' | 'admin';
}

export type DispatchResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type Handler = (
  payload: Record<string, unknown>,
  ctx: DispatchContext,
) => Promise<DispatchResult>;

function nextNumber(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function exceedsThreshold(amountPkr: number, key: keyof typeof DEFAULT_APPROVAL_THRESHOLDS_PKR): boolean {
  const t = DEFAULT_APPROVAL_THRESHOLDS_PKR[key];
  if (!t) return false;
  return (
    (t.supervisor !== null && amountPkr > t.supervisor) ||
    (t.farm_manager !== null && amountPkr > t.farm_manager)
  );
}

const dieselPurchaseHandler: Handler = async (raw, ctx) => {
  const parsed = dieselPurchaseSchema.safeParse({ entityId: ctx.entityId, ...raw });
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(dieselPurchases)
    .values({
      entityId: d.entityId,
      purchasedAt: new Date(d.purchasedAt),
      vendorName: d.vendorName,
      vendorLocation: d.vendorLocation ?? null,
      quantityLiters: d.quantityLiters.toString(),
      rateLiterPkr: d.rateLiterPkr.toString(),
      totalPkr: d.totalPkr.toString(),
      paymentMethod: d.paymentMethod,
      filledToTankId: d.filledToTankId ?? null,
      filledDirectlyToAssetId: d.filledDirectlyToAssetId ?? null,
      receiptPhotoUrls: d.receiptPhotoUrls,
      notes: d.notes ?? null,
      createdBy: ctx.userId,
    })
    .returning();
  const amount = Number(d.totalPkr);
  if (exceedsThreshold(amount, 'diesel_purchase')) {
    await submitApproval({
      entityId: d.entityId,
      approvalType: 'diesel_purchase',
      sourceModule: 'diesel',
      sourceRecordId: row!.id,
      title: `Diesel purchase ${d.quantityLiters} L from ${d.vendorName}`,
      amountPkr: amount,
      payload: { dieselPurchaseId: row!.id, ...d },
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }
  return { ok: true, id: row!.id };
};

const dieselDailyLogHandler: Handler = async (raw, ctx) => {
  const parsed = dieselDailyLogSchema.safeParse({ entityId: ctx.entityId, ...raw });
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(dieselDailyLogs)
    .values({
      entityId: d.entityId,
      assetId: d.assetId,
      logDate: d.logDate,
      operatorId: d.operatorId ?? null,
      operatorName: d.operatorName,
      hourMeterStart: d.hourMeterStart.toString(),
      hourMeterEnd: d.hourMeterEnd.toString(),
      hoursRun: d.hoursRun.toString(),
      dieselFilledLiters: d.dieselFilledLiters.toString(),
      rateLiterPkr: d.rateLiterPkr.toString(),
      totalCostPkr: d.totalCostPkr.toString(),
      sourceTankId: d.sourceTankId ?? null,
      taskFieldId: d.taskFieldId ?? null,
      taskKind: d.taskKind ?? null,
      taskNotes: d.taskNotes ?? null,
      receiptPhotoUrls: d.receiptPhotoUrls,
      idleHours: d.idleHours?.toString() ?? null,
      breakdownHours: d.breakdownHours?.toString() ?? null,
      createdBy: ctx.userId,
    })
    .returning();
  if (d.taskFieldId) {
    await allocateCost({
      entityId: d.entityId,
      sourceModule: 'diesel',
      sourceRecordId: row!.id,
      fieldId: d.taskFieldId,
      assetId: d.assetId,
      costPool: 'diesel',
      amountPkr: d.totalCostPkr,
      allocatedOn: d.logDate,
      allocationKey: 'direct',
    });
  }
  return { ok: true, id: row!.id };
};

const harvestHandler: Handler = async (raw, ctx) => {
  const parsed = harvestRecordCreateSchema.safeParse({ entityId: ctx.entityId, ...raw });
  if (!parsed.success) return { ok: false, error: parsed.error.message };
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
  await db.update(cropPlans).set({ currentStage: 'harvest', updatedAt: new Date() }).where(eq(cropPlans.id, d.cropPlanId));
  void ctx;
  return { ok: true, id: lot!.id };
};

const TYPE_TO_POOL: Record<string, CostPool> = {
  seed: 'seed',
  fertilizer: 'fertilizer',
  pesticide: 'pesticide',
  herbicide: 'pesticide',
  fungicide: 'pesticide',
  fuel: 'diesel',
  packaging: 'admin',
  other: 'admin',
};

const inputIssuanceHandler: Handler = async (raw, ctx) => {
  const parsed = inputIssuanceSchema.safeParse({ entityId: ctx.entityId, ...raw });
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(inputIssuances)
    .values({
      inputId: d.inputId,
      fieldId: d.fieldId,
      cropPlanId: d.cropPlanId ?? null,
      issuedOn: new Date(d.issuedOn),
      quantity: d.quantity.toString(),
      unitCostPkr: d.unitCostPkr.toString(),
      totalCostPkr: d.totalCostPkr.toString(),
      issuedTo: ctx.userId,
      receivedBy: d.receivedBy ?? null,
      purpose: d.purpose ?? null,
      notes: d.notes ?? null,
    })
    .returning();
  const [inputRow] = await db.select({ type: inputs.type }).from(inputs).where(eq(inputs.id, d.inputId)).limit(1);
  const pool: CostPool = (inputRow ? TYPE_TO_POOL[inputRow.type] : null) ?? 'admin';
  await allocateCost({
    entityId: d.entityId,
    sourceModule: 'input',
    sourceRecordId: row!.id,
    fieldId: d.fieldId,
    cropPlanId: d.cropPlanId ?? undefined,
    costPool: pool,
    amountPkr: d.totalCostPkr,
    allocatedOn: d.issuedOn.slice(0, 10),
    allocationKey: 'direct',
  });
  return { ok: true, id: row!.id };
};

const repairRequestHandler: Handler = async (raw, ctx) => {
  const parsed = repairRequestSchema.safeParse({ entityId: ctx.entityId, ...raw });
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(repairRequests)
    .values({
      entityId: d.entityId,
      assetId: d.assetId,
      requestNumber: nextNumber('RR'),
      reportedBy: ctx.userId,
      issueDescription: d.issueDescription,
      issueDescriptionUr: d.issueDescriptionUr ?? null,
      severity: d.severity,
      suggestedAction: d.suggestedAction ?? null,
      problemPhotoUrls: d.problemPhotoUrls,
      status: 'quotes_pending',
    })
    .returning();
  if (d.severity === 'major' || d.severity === 'breakdown') {
    await submitApproval({
      entityId: d.entityId,
      approvalType: 'repair',
      sourceModule: 'repair',
      sourceRecordId: row!.id,
      title: `Repair request ${row!.requestNumber} (${d.severity})`,
      amountPkr: 0,
      payload: { repairRequestId: row!.id, ...d },
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }
  return { ok: true, id: row!.id };
};

const milkRecordHandler: Handler = async (raw, ctx) => {
  const parsed = milkRecordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(milkRecords)
    .values({
      animalId: d.animalId,
      recordedOn: d.recordedOn,
      session: d.session,
      litres: d.litres.toString(),
      fatPct: d.fatPct?.toString() ?? null,
      snfPct: d.snfPct?.toString() ?? null,
      recordedBy: ctx.userId,
    })
    .returning();
  return { ok: true, id: row!.id };
};

const feedRecordHandler: Handler = async (raw, ctx) => {
  const parsed = feedRecordSchema.safeParse({ entityId: ctx.entityId, ...raw });
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const totalCostPkr = d.feedMix.reduce((a, m) => a + Number(m.costPkr), 0);
  const [row] = await db
    .insert(feedRecords)
    .values({
      animalId: d.animalId ?? null,
      groupKey: d.groupKey ?? null,
      recordedOn: d.recordedOn,
      feedMix: d.feedMix,
      totalCostPkr: totalCostPkr.toFixed(2),
      recordedBy: ctx.userId,
    })
    .returning();
  if (totalCostPkr > 0) {
    await allocateCost({
      entityId: d.entityId,
      sourceModule: 'feed',
      sourceRecordId: row!.id,
      costPool: 'feed',
      amountPkr: totalCostPkr,
      allocatedOn: d.recordedOn,
      allocationKey: 'direct',
    });
  }
  return { ok: true, id: row!.id };
};

const healthEventHandler: Handler = async (raw, ctx) => {
  const parsed = healthEventSchema.safeParse({ entityId: ctx.entityId, ...raw });
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(healthEvents)
    .values({
      animalId: d.animalId,
      eventType: d.eventType,
      eventDate: d.eventDate,
      diagnosis: d.diagnosis ?? null,
      treatment: d.treatment ?? null,
      medicineCostPkr: d.medicineCostPkr ?? null,
      vetCostPkr: d.vetCostPkr ?? null,
      withdrawalUntil: d.withdrawalUntil ?? null,
      notes: d.notes ?? null,
    })
    .returning();
  const total = Number(d.medicineCostPkr ?? 0) + Number(d.vetCostPkr ?? 0);
  if (total > 0) {
    await allocateCost({
      entityId: d.entityId,
      sourceModule: 'vet',
      sourceRecordId: row!.id,
      costPool: 'vet',
      amountPkr: total,
      allocatedOn: d.eventDate,
      allocationKey: 'direct',
    });
  }
  void ctx;
  return { ok: true, id: row!.id };
};

const attendanceRecordSchema = z.object({
  workerId: z.string().uuid(),
  workDate: z.string(),
  status: z.enum(['present', 'absent', 'leave', 'half_day', 'late']).default('present'),
  checkInAt: z.string().optional(),
  checkOutAt: z.string().optional(),
  checkInGps: z.unknown().optional(),
  checkOutGps: z.unknown().optional(),
  withinGeofence: z.boolean().optional(),
  notes: z.string().optional(),
});

const attendanceHandler: Handler = async (raw, ctx) => {
  const parsed = attendanceRecordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(attendanceRecords)
    .values({
      workerId: d.workerId,
      entityId: ctx.entityId,
      workDate: d.workDate,
      status: d.status,
      checkInAt: d.checkInAt ? new Date(d.checkInAt) : null,
      checkOutAt: d.checkOutAt ? new Date(d.checkOutAt) : null,
      checkInGps: (d.checkInGps as object | undefined) ?? null,
      checkOutGps: (d.checkOutGps as object | undefined) ?? null,
      withinGeofence: d.withinGeofence ?? null,
      notes: d.notes ?? null,
      source: 'pwa',
    })
    .returning();
  return { ok: true, id: row!.id };
};

const taskCompletionSchema = z.object({
  taskId: z.string().uuid(),
  workerId: z.string().uuid(),
  completedAt: z.string().optional(),
  hoursWorked: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  proofPhotoUrls: z.array(z.string().url()).default([]),
});

const taskCompletionHandler: Handler = async (raw, ctx) => {
  const parsed = taskCompletionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(taskCompletions)
    .values({
      taskId: d.taskId,
      workerId: d.workerId,
      completedAt: d.completedAt ? new Date(d.completedAt) : new Date(),
      hoursWorked: d.hoursWorked !== undefined ? d.hoursWorked.toString() : null,
      notes: d.notes ?? null,
      proofPhotoUrls: d.proofPhotoUrls,
    })
    .returning();
  void ctx;
  return { ok: true, id: row!.id };
};

const HANDLERS: Record<string, Handler> = {
  diesel_purchases: dieselPurchaseHandler,
  diesel_purchase: dieselPurchaseHandler,
  diesel_daily_logs: dieselDailyLogHandler,
  diesel_daily_log: dieselDailyLogHandler,
  harvest_records: harvestHandler,
  input_issuances: inputIssuanceHandler,
  repair_requests: repairRequestHandler,
  milk_records: milkRecordHandler,
  feed_records: feedRecordHandler,
  health_events: healthEventHandler,
  attendance_records: attendanceHandler,
  task_completions: taskCompletionHandler,
};

export async function dispatch(
  resource: string,
  operation: string,
  payload: Record<string, unknown>,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  if (operation !== 'insert' && operation !== 'attach_photo') {
    return { ok: false, error: `Unsupported operation: ${operation}` };
  }
  const handler = HANDLERS[resource];
  if (!handler) return { ok: false, error: `Unknown resource: ${resource}` };
  return handler(payload, ctx);
}

export const SUPPORTED_RESOURCES = Object.keys(HANDLERS);
