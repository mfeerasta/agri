'use server';
import { revalidatePath } from 'next/cache';
import {
  buyerCreateSchema,
  arhtiCreateSchema,
  mandiDispatchSchema,
  mandiSettlementSchema,
  milkDispatchSchema,
  milkSettlementSchema,
} from '@zameen/shared/validators';
import {
  db,
  buyers,
  arhtis,
  mandiDispatches,
  mandiSettlements,
  milkDispatches,
  milkSettlements,
} from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { postJournal } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

export async function createBuyer(raw: unknown): Promise<R> {
  const parsed = buyerCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const [row] = await db.insert(buyers).values({
    entityId: parsed.data.entityId,
    code: parsed.data.code,
    name: parsed.data.name,
    category: parsed.data.category,
    phone: parsed.data.phone ?? null,
    address: parsed.data.address ?? null,
  }).returning();
  revalidatePath('/sales/buyers');
  return { ok: true, id: row!.id };
}

export async function createArhti(raw: unknown): Promise<R> {
  const parsed = arhtiCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const [row] = await db.insert(arhtis).values({
    entityId: parsed.data.entityId,
    name: parsed.data.name,
    mandiLocation: parsed.data.mandiLocation ?? null,
    commissionPct: parsed.data.commissionPct?.toString() ?? null,
    phone: parsed.data.phone ?? null,
  }).returning();
  revalidatePath('/sales/arhtis');
  return { ok: true, id: row!.id };
}

export async function submitMandiDispatch(raw: unknown): Promise<R> {
  const parsed = mandiDispatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const dispatchNumber = `MD-${Date.now()}`;
  const [row] = await db
    .insert(mandiDispatches)
    .values({
      entityId: data.entityId,
      dispatchNumber,
      produceLotId: data.produceLotId ?? null,
      arhtiId: data.arhtiId,
      dispatchedOn: data.dispatchedOn,
      vehicleNumber: data.vehicleNumber ?? null,
      driverName: data.driverName ?? null,
      netWeightKg: data.netWeightKg.toString(),
      bagsCount: data.bagsCount?.toString() ?? null,
      freightPkr: data.freightPkr ?? null,
      status: 'dispatched',
    })
    .returning();

  const estimatedValue = Number(data.estimatedValuePkr ?? 0);
  if (estimatedValue > 500_000) {
    const payload = { mandiDispatchId: row!.id, ...data };
    const contextSnapshot = await buildFullContext({
      entityId: data.entityId,
      approvalType: 'crop_sale',
      payload: payload as Record<string, unknown>,
      requesterUserId: ctx.userId,
      sourceModule: 'sales',
    });
    await submitApproval({
      entityId: data.entityId,
      approvalType: 'crop_sale',
      sourceModule: 'sales',
      sourceRecordId: row!.id,
      title: `Mandi dispatch ${dispatchNumber}`,
      amountPkr: estimatedValue,
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }

  revalidatePath('/sales/mandi-dispatches');
  return { ok: true, id: row!.id };
}

export async function submitMandiSettlement(raw: unknown): Promise<R> {
  const parsed = mandiSettlementSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(mandiSettlements)
    .values({
      mandiDispatchId: data.mandiDispatchId,
      settledOn: data.settledOn,
      grossPricePkr: data.grossPricePkr.toFixed(2),
      commissionPkr: data.commissionPkr.toFixed(2),
      loadingPkr: data.loadingPkr.toFixed(2),
      weighingPkr: data.weighingPkr.toFixed(2),
      otherDeductionsPkr: data.otherDeductionsPkr.toFixed(2),
      netReceivedPkr: data.netReceivedPkr.toFixed(2),
      pattiPhotoUrl: data.pattiPhotoUrl ?? null,
    })
    .returning();

  revalidatePath(`/sales/mandi-dispatches/${data.mandiDispatchId}`);
  return { ok: true, id: row!.id };
}

export async function submitMilkDispatch(raw: unknown): Promise<R> {
  const parsed = milkDispatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const expectedAmount = Number((data.litres * data.ratePerLitrePkr).toFixed(2));
  const [row] = await db
    .insert(milkDispatches)
    .values({
      entityId: data.entityId,
      buyerId: data.buyerId,
      dispatchedOn: data.dispatchedOn,
      session: data.session,
      litres: data.litres.toString(),
      fatPct: data.fatPct?.toString() ?? null,
      snfPct: data.snfPct?.toString() ?? null,
      ratePerLitrePkr: data.ratePerLitrePkr.toString(),
      expectedAmountPkr: expectedAmount.toFixed(2),
    })
    .returning();
  revalidatePath('/sales/milk');
  return { ok: true, id: row!.id };
}

export async function submitMilkSettlement(raw: unknown): Promise<R> {
  const parsed = milkSettlementSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const [row] = await db
    .insert(milkSettlements)
    .values({
      entityId: data.entityId,
      buyerId: data.buyerId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      totalLitres: data.totalLitres.toString(),
      agreedAmountPkr: data.agreedAmountPkr,
      deductionsPkr: data.deductionsPkr,
      netReceivedPkr: data.netReceivedPkr,
      statementPhotoUrls: data.statementPhotoUrls,
    })
    .returning();
  revalidatePath('/sales/milk');
  return { ok: true, id: row!.id };
}
