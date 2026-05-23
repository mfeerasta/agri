'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, assets, maintenanceExecutions, maintenancePlans } from '@zameen/db';
import { allocateCost } from '@zameen/finance';
import { maintenanceExecutionSchema } from '@zameen/shared/validators';
import { submitApproval } from '@zameen/approvals';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function recordMaintenance(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const parsed = maintenanceExecutionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const data = parsed.data;

  const [asset] = await db.select().from(assets).where(eq(assets.id, data.assetId)).limit(1);
  if (!asset) return { ok: false, error: 'Asset not found' };

  let approvalRequestId: string | undefined;
  const sup = DEFAULT_APPROVAL_THRESHOLDS_PKR.preventive_maintenance.supervisor ?? 0;
  if (data.totalCostPkr >= sup) {
    const ap = await submitApproval({
      entityId: asset.entityId,
      approvalType: 'preventive_maintenance',
      sourceModule: 'maintenance',
      title: `Preventive maintenance — ${asset.code}`,
      amountPkr: data.totalCostPkr,
      payload: { assetId: data.assetId, planId: data.planId, partsUsed: data.partsUsed },
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
    approvalRequestId = ap.id;
  }

  const [row] = await db
    .insert(maintenanceExecutions)
    .values({
      planId: data.planId,
      assetId: data.assetId,
      executedOn: data.executedOn,
      executedBy: data.executedBy ?? ctx.userId,
      hourMeterAtService: data.hourMeterAtService?.toString(),
      partsUsed: data.partsUsed,
      laborHours: data.laborHours?.toString(),
      partsCostPkr: data.partsCostPkr.toString(),
      laborCostPkr: data.laborCostPkr.toString(),
      externalServiceCostPkr: data.externalServiceCostPkr.toString(),
      totalCostPkr: data.totalCostPkr.toString(),
      notes: data.notes,
      photoUrls: data.photoUrls,
      approvalRequestId,
    })
    .returning();

  if (data.planId) {
    await db
      .update(maintenancePlans)
      .set({ lastExecutedAt: new Date(), nextDueAt: null })
      .where(eq(maintenancePlans.id, data.planId));
  }

  await allocateCost({
    entityId: asset.entityId,
    sourceModule: 'other',
    sourceRecordId: row!.id,
    costPool: 'asset_maintenance',
    amountPkr: data.totalCostPkr,
    allocatedOn: data.executedOn,
    assetId: data.assetId,
    allocationKey: 'maintenance-direct',
    notes: `Preventive maintenance: ${data.notes ?? ''}`.slice(0, 256),
  });

  revalidatePath('/assets/maintenance');
  revalidatePath(`/assets/${data.assetId}/maintenance`);
  return { ok: true, id: row!.id };
}
