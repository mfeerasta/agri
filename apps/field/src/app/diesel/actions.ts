'use server';
import { revalidatePath } from 'next/cache';
import { dieselPurchaseSchema, dieselDailyLogSchema } from '@zameen/shared/validators';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { db, dieselPurchases, dieselDailyLogs, assetHourMeters } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { submitApproval } from '@zameen/approvals';
import { allocateCost } from '@zameen/finance';
import { getFieldSession } from '../../lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function submitDieselPurchase(raw: unknown): Promise<Result> {
  const parsed = dieselPurchaseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getFieldSession();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(dieselPurchases)
    .values({
      entityId: data.entityId,
      purchasedAt: new Date(data.purchasedAt),
      vendorName: data.vendorName,
      vendorLocation: data.vendorLocation ?? null,
      quantityLiters: data.quantityLiters.toString(),
      rateLiterPkr: data.rateLiterPkr.toString(),
      totalPkr: data.totalPkr.toString(),
      paymentMethod: data.paymentMethod,
      filledToTankId: data.filledToTankId ?? null,
      filledDirectlyToAssetId: data.filledDirectlyToAssetId ?? null,
      receiptPhotoUrls: data.receiptPhotoUrls,
      notes: data.notes ?? null,
      createdBy: ctx.userId,
    })
    .returning();

  const amountPkr = Number(data.totalPkr);
  const thresholds = DEFAULT_APPROVAL_THRESHOLDS_PKR.diesel_purchase;
  const needsApproval =
    (thresholds.supervisor !== null && amountPkr > thresholds.supervisor) ||
    (thresholds.farm_manager !== null && amountPkr > thresholds.farm_manager);

  if (needsApproval) {
    await submitApproval({
      entityId: data.entityId,
      approvalType: 'diesel_purchase',
      sourceModule: 'diesel',
      sourceRecordId: row!.id,
      title: `Diesel purchase ${data.quantityLiters} L from ${data.vendorName}`,
      amountPkr,
      payload: { dieselPurchaseId: row!.id, ...data },
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }

  revalidatePath('/diesel');
  return { ok: true, id: row!.id };
}

export async function submitDieselDailyLog(raw: unknown): Promise<Result> {
  const parsed = dieselDailyLogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getFieldSession();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(dieselDailyLogs)
    .values({
      entityId: data.entityId,
      assetId: data.assetId,
      logDate: data.logDate,
      operatorId: data.operatorId ?? ctx.userId,
      operatorName: data.operatorName,
      hourMeterStart: data.hourMeterStart.toString(),
      hourMeterEnd: data.hourMeterEnd.toString(),
      hoursRun: data.hoursRun.toString(),
      dieselFilledLiters: data.dieselFilledLiters.toString(),
      rateLiterPkr: data.rateLiterPkr.toString(),
      totalCostPkr: data.totalCostPkr.toString(),
      sourceTankId: data.sourceTankId ?? null,
      taskFieldId: data.taskFieldId ?? null,
      taskKind: data.taskKind ?? null,
      taskNotes: data.taskNotes ?? null,
      receiptPhotoUrls: data.receiptPhotoUrls,
      idleHours: data.idleHours?.toString() ?? null,
      breakdownHours: data.breakdownHours?.toString() ?? null,
      createdBy: ctx.userId,
    })
    .returning();

  if (data.taskFieldId) {
    await allocateCost({
      entityId: data.entityId,
      sourceModule: 'diesel',
      sourceRecordId: row!.id,
      fieldId: data.taskFieldId,
      assetId: data.assetId,
      costPool: 'diesel',
      amountPkr: data.totalCostPkr,
      allocatedOn: data.logDate,
      allocationKey: 'direct',
    });
  }

  revalidatePath('/diesel');
  return { ok: true, id: row!.id };
}

export async function lastHourMeter(assetId: string): Promise<number | null> {
  const rows = await db
    .select()
    .from(assetHourMeters)
    .where(eq(assetHourMeters.assetId, assetId))
    .orderBy(desc(assetHourMeters.recordedOn))
    .limit(1);
  if (!rows[0]) return null;
  return Number(rows[0].meterReading);
}
