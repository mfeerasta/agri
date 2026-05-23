'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import {
  buyerCrmCreateSchema,
  salesOpportunitySchema,
  opportunityStageUpdateSchema,
  forwardContractCreateSchema,
  contractDeliverySchema,
} from '@zameen/shared/validators';
import {
  db,
  buyersCrm,
  salesOpportunities,
  forwardContracts,
  contractDeliveries,
} from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

export async function createBuyerCrm(raw: unknown): Promise<R> {
  const parsed = buyerCrmCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db.insert(buyersCrm).values({
    entityId: d.entityId,
    name: d.name,
    nameUr: d.nameUr ?? null,
    buyerType: d.buyerType,
    contactPerson: d.contactPerson ?? null,
    phone: d.phone ?? null,
    altPhone: d.altPhone ?? null,
    email: d.email && d.email.length > 0 ? d.email : null,
    cnic: d.cnic ?? null,
    ntn: d.ntn ?? null,
    address: d.address ?? null,
    paymentTermsDays: d.paymentTermsDays ?? null,
    creditLimitPkr: d.creditLimitPkr?.toFixed(2) ?? null,
    notes: d.notes ?? null,
    status: d.status,
    blacklistedReason: d.blacklistedReason ?? null,
  }).returning();
  revalidatePath('/app/sales/buyers');
  return { ok: true, id: row!.id };
}

export async function createOpportunity(raw: unknown): Promise<R> {
  const parsed = salesOpportunitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db.insert(salesOpportunities).values({
    entityId: d.entityId,
    buyerId: d.buyerId ?? null,
    buyerNameFreeform: d.buyerNameFreeform ?? null,
    cropCode: d.cropCode,
    estimatedKg: d.estimatedKg.toFixed(2),
    targetPricePerKgPkr: d.targetPricePerKgPkr?.toFixed(2) ?? null,
    stage: d.stage,
    expectedCloseDate: d.expectedCloseDate ?? null,
    winProbabilityPct: d.winProbabilityPct ?? null,
    source: d.source ?? null,
    notes: d.notes ?? null,
    createdBy: ctx.userId,
  }).returning();
  revalidatePath('/app/sales/pipeline');
  return { ok: true, id: row!.id };
}

export async function updateOpportunityStage(raw: unknown): Promise<R> {
  const parsed = opportunityStageUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const updates: Record<string, unknown> = {
    stage: d.stage,
    updatedAt: new Date(),
  };
  if (d.stage === 'lost') {
    updates.lostReason = d.lostReason ?? null;
    updates.actualCloseDate = new Date().toISOString().slice(0, 10);
  }
  if (d.stage === 'delivered' || d.stage === 'contracted') {
    updates.actualCloseDate = new Date().toISOString().slice(0, 10);
  }
  await db.update(salesOpportunities).set(updates).where(eq(salesOpportunities.id, d.id));
  revalidatePath('/app/sales/pipeline');
  return { ok: true, id: d.id };
}

export async function createForwardContract(raw: unknown): Promise<R> {
  const parsed = forwardContractCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const totalValue = Number((d.committedKg * d.agreedPricePerKgPkr).toFixed(2));

  const [row] = await db.insert(forwardContracts).values({
    entityId: d.entityId,
    buyerId: d.buyerId,
    contractNumber: d.contractNumber,
    signedOn: d.signedOn,
    cropCode: d.cropCode,
    committedKg: d.committedKg.toFixed(2),
    agreedPricePerKgPkr: d.agreedPricePerKgPkr.toFixed(2),
    deliveryWindowStart: d.deliveryWindowStart,
    deliveryWindowEnd: d.deliveryWindowEnd,
    deliveryPoint: d.deliveryPoint ?? null,
    paymentTerms: d.paymentTerms ?? null,
    advanceReceivedPkr: d.advanceReceivedPkr.toFixed(2),
    advanceReceivedOn: d.advanceReceivedOn ?? null,
    qualitySpecs: d.qualitySpecs ?? null,
    penaltyClause: d.penaltyClause ?? null,
    contractDocUrl: d.contractDocUrl ?? null,
    createdBy: ctx.userId,
  }).returning();

  const contextSnapshot = await buildFullContext({
    entityId: d.entityId,
    approvalType: 'forward_contract',
    payload: { ...d, totalValue } as Record<string, unknown>,
    requesterUserId: ctx.userId,
    sourceModule: 'sales',
  });
  const approval = await submitApproval({
    entityId: d.entityId,
    approvalType: 'forward_contract',
    sourceModule: 'sales',
    sourceRecordId: row!.id,
    title: `Forward contract ${d.contractNumber} (${d.cropCode}, ${d.committedKg.toLocaleString()} kg)`,
    amountPkr: totalValue,
    payload: { ...d, totalValue },
    contextSnapshot,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });
  if (approval?.id) {
    await db.update(forwardContracts).set({ approvalRequestId: approval.id }).where(eq(forwardContracts.id, row!.id));
  }
  revalidatePath('/app/sales/forward-contracts');
  return { ok: true, id: row!.id };
}

export async function recordContractDelivery(raw: unknown): Promise<R> {
  const parsed = contractDeliverySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;

  return await db.transaction(async (tx) => {
    const [delivery] = await tx.insert(contractDeliveries).values({
      contractId: d.contractId,
      deliveredOn: d.deliveredOn,
      kg: d.kg.toFixed(2),
      pkr: d.pkr.toFixed(2),
      produceLotIds: d.produceLotIds,
      deliveryNoteUrl: d.deliveryNoteUrl ?? null,
      notes: d.notes ?? null,
    }).returning();

    const [contract] = await tx.select().from(forwardContracts).where(eq(forwardContracts.id, d.contractId));
    if (!contract) return { ok: false as const, error: 'Contract not found' };

    const newKg = Number(contract.deliveredKg) + d.kg;
    const newPkr = Number(contract.deliveredPkr) + d.pkr;
    const committed = Number(contract.committedKg);
    let nextStatus = contract.status;
    if (newKg >= committed) nextStatus = 'fulfilled';
    else if (newKg > 0) nextStatus = 'partially_delivered';

    await tx.update(forwardContracts).set({
      deliveredKg: newKg.toFixed(2),
      deliveredPkr: newPkr.toFixed(2),
      status: nextStatus,
    }).where(eq(forwardContracts.id, d.contractId));

    revalidatePath(`/app/sales/forward-contracts/${d.contractId}`);
    revalidatePath('/app/sales/forward-contracts');
    return { ok: true as const, id: delivery!.id };
  });
}

export async function flagContractBreach(contractId: string, reason: string): Promise<R> {
  await db.update(forwardContracts).set({ status: 'breached' }).where(eq(forwardContracts.id, contractId));
  revalidatePath('/app/sales/forward-contracts');
  return { ok: true, id: contractId };
}
