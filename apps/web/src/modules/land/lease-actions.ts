'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  db,
  leaseContracts,
  leasePayments,
  sharecropSettlements,
  fields,
} from '@zameen/db';
import {
  leaseContractCreateSchema,
  leasePaymentSchema,
  type LeaseContractCreateInput,
  type LeasePaymentInput,
} from '@zameen/shared/validators';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { allocateCost } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

function normaliseCnic(cnic?: string): string | null {
  if (!cnic) return null;
  const digits = cnic.replace(/-/g, '');
  return digits.length === 13 ? digits : null;
}

export async function createLeaseContract(raw: unknown): Promise<Result> {
  const parsed = leaseContractCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d: LeaseContractCreateInput = parsed.data;

  const [row] = await db
    .insert(leaseContracts)
    .values({
      entityId: d.entityId,
      fieldId: d.fieldId,
      counterpartyName: d.counterpartyName,
      counterpartyCnic: normaliseCnic(d.counterpartyCnic ?? undefined),
      counterpartyPhone: d.counterpartyPhone ? d.counterpartyPhone : null,
      tenure: d.tenure,
      startDate: d.startDate,
      endDate: d.endDate ? d.endDate : null,
      annualRentPkr: d.annualRentPkr?.toString() ?? null,
      rentPaymentSchedule: d.rentPaymentSchedule ?? null,
      sharePctLandowner: d.sharePctLandowner?.toString() ?? null,
      sharePctTenant: d.sharePctTenant?.toString() ?? null,
      inputShareArrangement: d.inputShareArrangement ?? null,
      deedDocUrl: d.deedDocUrl ? d.deedDocUrl : null,
      status: d.status,
      notes: d.notes ?? null,
    })
    .returning();

  revalidatePath('/land/leases');
  return { ok: true, id: row!.id };
}

export async function recordLeasePayment(raw: unknown): Promise<Result> {
  const parsed = leasePaymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d: LeasePaymentInput = parsed.data;

  const [lease] = await db.select().from(leaseContracts).where(eq(leaseContracts.id, d.leaseId)).limit(1);
  if (!lease) return { ok: false, error: 'Lease not found' };

  const [row] = await db
    .insert(leasePayments)
    .values({
      leaseId: d.leaseId,
      paidOn: d.paidOn,
      amountPkr: d.amountPkr.toString(),
      paymentMethod: d.paymentMethod,
      referenceNumber: d.referenceNumber ?? null,
      receiptUrl: d.receiptUrl ? d.receiptUrl : null,
      notes: d.notes ?? null,
      createdBy: ctx.userId,
    })
    .returning();

  // Route through approval engine
  const thresholds = DEFAULT_APPROVAL_THRESHOLDS_PKR.lease_payment;
  const needsApproval =
    (thresholds.supervisor !== null && d.amountPkr > thresholds.supervisor) ||
    (thresholds.farm_manager !== null && d.amountPkr > thresholds.farm_manager) ||
    (thresholds.director !== null && d.amountPkr > thresholds.director);

  if (needsApproval) {
    const payload = {
      leasePaymentId: row!.id,
      leaseId: lease.id,
      counterparty: lease.counterpartyName,
      amountPkr: d.amountPkr,
      paidOn: d.paidOn,
      paymentMethod: d.paymentMethod,
    };
    const contextSnapshot = await buildFullContext({
      entityId: lease.entityId,
      approvalType: 'lease_payment',
      payload,
      requesterUserId: ctx.userId,
      sourceModule: 'lease',
    });
    const approval = await submitApproval({
      entityId: lease.entityId,
      approvalType: 'lease_payment',
      sourceModule: 'lease',
      sourceRecordId: row!.id,
      title: `Lease payment to ${lease.counterpartyName}`,
      amountPkr: d.amountPkr,
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
    await db
      .update(leasePayments)
      .set({ approvalRequestId: approval.id })
      .where(eq(leasePayments.id, row!.id));
  }

  // Cost allocation under land_rent pool
  await allocateCost({
    entityId: lease.entityId,
    sourceModule: 'other',
    sourceRecordId: row!.id,
    fieldId: lease.fieldId,
    costPool: 'land_rent',
    amountPkr: d.amountPkr,
    allocatedOn: d.paidOn,
    notes: `Rent to ${lease.counterpartyName} (${lease.tenure})`,
  });

  revalidatePath(`/land/leases/${d.leaseId}`);
  return { ok: true, id: row!.id };
}

export async function updateLeaseStatus(leaseId: string, status: 'active' | 'expired' | 'terminated' | 'disputed'): Promise<Result> {
  const [row] = await db
    .update(leaseContracts)
    .set({ status, updatedAt: new Date() })
    .where(eq(leaseContracts.id, leaseId))
    .returning();
  if (!row) return { ok: false, error: 'Lease not found' };
  revalidatePath(`/land/leases/${leaseId}`);
  return { ok: true, id: row.id };
}

export async function listFieldsForEntity(entityId: string) {
  return db.select({ id: fields.id, code: fields.code, name: fields.name }).from(fields).where(eq(fields.id, fields.id));
}

export async function listLeasePayments(leaseId: string) {
  return db.select().from(leasePayments).where(eq(leasePayments.leaseId, leaseId));
}

export async function listSharecropSettlements(leaseId: string) {
  return db.select().from(sharecropSettlements).where(eq(sharecropSettlements.leaseId, leaseId));
}
