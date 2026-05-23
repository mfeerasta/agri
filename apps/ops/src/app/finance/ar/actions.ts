'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import {
  db,
  arInvoices,
  arReceipts,
  buyerCreditLimits,
  arDisputes,
} from '@zameen/db';
import { postJournal, nextVoucherNumber, checkBuyerCreditAvailability } from '@zameen/finance';
import { submitApproval } from '@zameen/approvals';
import {
  arInvoiceCreateSchema,
  arReceiptCreateSchema,
  buyerCreditLimitUpsertSchema,
  arDisputeCreateSchema,
  arDisputeResolveSchema,
} from '@zameen/shared/validators';
import { getSessionContext } from '@/lib/session';

function n(v: FormDataEntryValue | null): string {
  return v == null ? '' : String(v);
}
function num(v: FormDataEntryValue | null): number {
  const x = Number(String(v ?? '0'));
  return Number.isFinite(x) ? x : 0;
}

export async function createArInvoice(formData: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('Not authenticated');

  const parsed = arInvoiceCreateSchema.parse({
    entityId: ctx.entityId,
    buyerId: n(formData.get('buyerId')),
    invoiceNumber: n(formData.get('invoiceNumber')),
    invoiceDate: n(formData.get('invoiceDate')),
    dueDate: n(formData.get('dueDate')),
    salesDispatchId: n(formData.get('salesDispatchId')) || undefined,
    deliveryId: n(formData.get('deliveryId')) || undefined,
    forwardContractId: n(formData.get('forwardContractId')) || undefined,
    description: n(formData.get('description')) || undefined,
    amountPkr: n(formData.get('amountPkr')),
    taxPkr: n(formData.get('taxPkr')) || '0',
    discountPkr: n(formData.get('discountPkr')) || '0',
    paymentTermsDays: formData.get('paymentTermsDays') ? num(formData.get('paymentTermsDays')) : undefined,
    invoicePdfUrl: n(formData.get('invoicePdfUrl')) || undefined,
  });

  const amount = Number(parsed.amountPkr);
  const tax = Number(parsed.taxPkr ?? 0);
  const discount = Number(parsed.discountPkr ?? 0);
  const total = amount + tax - discount;

  const check = await checkBuyerCreditAvailability(
    parsed.entityId,
    parsed.buyerId,
    total,
    parsed.invoiceDate,
  );
  if (!check.ok) {
    throw new Error(
      `Credit limit exceeded for buyer. Limit: PKR ${check.creditLimitPkr?.toFixed(2)}, ` +
        `current outstanding: PKR ${check.currentOutstandingPkr.toFixed(2)}, ` +
        `new invoice: PKR ${total.toFixed(2)}. Collect payment first or raise the limit.`,
    );
  }

  await db.insert(arInvoices).values({
    entityId: parsed.entityId,
    buyerId: parsed.buyerId,
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate,
    dueDate: parsed.dueDate,
    salesDispatchId: parsed.salesDispatchId,
    deliveryId: parsed.deliveryId,
    forwardContractId: parsed.forwardContractId,
    description: parsed.description,
    amountPkr: amount.toFixed(2),
    taxPkr: tax.toFixed(2),
    discountPkr: discount.toFixed(2),
    totalPkr: total.toFixed(2),
    paidPkr: '0',
    outstandingPkr: total.toFixed(2),
    status: 'open',
    paymentTermsDays: parsed.paymentTermsDays,
    invoicePdfUrl: parsed.invoicePdfUrl,
  });

  revalidatePath('/finance/ar');
  revalidatePath('/finance/ar/invoices');
  redirect('/finance/ar/invoices');
}

export async function recordArReceipt(formData: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('Not authenticated');

  const parsed = arReceiptCreateSchema.parse({
    invoiceId: n(formData.get('invoiceId')),
    receivedOn: n(formData.get('receivedOn')),
    amountPkr: n(formData.get('amountPkr')),
    method: n(formData.get('method')) as 'cash' | 'cheque' | 'bank_transfer' | 'online' | 'adjustment' | 'barter',
    referenceNumber: n(formData.get('referenceNumber')) || undefined,
    bankName: n(formData.get('bankName')) || undefined,
    clearedOn: n(formData.get('clearedOn')) || undefined,
    notes: n(formData.get('notes')) || undefined,
  });

  const [inv] = await db.select().from(arInvoices).where(eq(arInvoices.id, parsed.invoiceId)).limit(1);
  if (!inv) throw new Error('Invoice not found');
  if (inv.entityId !== ctx.entityId) throw new Error('Cross-entity write blocked');

  const amount = Number(parsed.amountPkr);
  if (amount <= 0) throw new Error('Receipt amount must be > 0');
  if (amount > Number(inv.outstandingPkr) + 0.005) {
    throw new Error('Receipt exceeds outstanding amount on invoice');
  }

  const approval = await submitApproval({
    entityId: ctx.entityId,
    approvalType: 'ar_receipt',
    sourceModule: 'ar-receipts',
    title: `AR receipt ${parsed.method} — ${amount.toFixed(2)} PKR vs invoice ${inv.invoiceNumber}`,
    amountPkr: amount,
    payload: { ...parsed },
    contextSnapshot: {
      summary: {
        invoiceNumber: inv.invoiceNumber,
        buyerId: inv.buyerId,
        outstandingPkr: Number(inv.outstandingPkr),
        receivingPkr: amount,
        method: parsed.method,
      },
    } as never,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  const accountCash = parsed.method === 'cash' ? '1010' : '1020';
  const journalNumber = await nextVoucherNumber(
    ctx.entityId,
    parsed.method === 'cash' ? 'cash-receipt' : 'bank-receipt',
  );
  const journalEntryId = await postJournal({
    entityId: ctx.entityId,
    postedOn: parsed.receivedOn,
    narration: `AR receipt for ${inv.invoiceNumber} via ${parsed.method}`,
    sourceModule: 'ar-receipts',
    approvalRequestId: approval.id,
    postedBy: ctx.userId,
    journalNumber,
    lines: [
      { accountCode: accountCash, debitPkr: amount, narration: 'Cash/Bank received' },
      { accountCode: '1200', creditPkr: amount, narration: 'Reduce accounts receivable' },
    ],
  });

  await db.insert(arReceipts).values({
    invoiceId: parsed.invoiceId,
    receivedOn: parsed.receivedOn,
    amountPkr: amount.toFixed(2),
    method: parsed.method,
    referenceNumber: parsed.referenceNumber,
    bankName: parsed.bankName,
    clearedOn: parsed.clearedOn,
    journalEntryId,
    approvalRequestId: approval.id,
    notes: parsed.notes,
    createdBy: ctx.userId,
  });

  const newPaid = Number(inv.paidPkr) + amount;
  const newOutstanding = Number(inv.totalPkr) - newPaid;
  const newStatus =
    newOutstanding <= 0.005 ? 'paid' : newPaid > 0 ? 'partial' : inv.status;
  await db
    .update(arInvoices)
    .set({
      paidPkr: newPaid.toFixed(2),
      outstandingPkr: newOutstanding.toFixed(2),
      status: newStatus,
      updatedAt: sql`now()`,
    })
    .where(eq(arInvoices.id, inv.id));

  revalidatePath('/finance/ar');
  revalidatePath('/finance/ar/invoices');
  redirect('/finance/ar');
}

export async function upsertBuyerCreditLimit(formData: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('Not authenticated');

  const parsed = buyerCreditLimitUpsertSchema.parse({
    entityId: ctx.entityId,
    buyerId: n(formData.get('buyerId')),
    creditLimitPkr: n(formData.get('creditLimitPkr')),
    paymentTermsDays: num(formData.get('paymentTermsDays')),
    earlyPaymentDiscountPct: formData.get('earlyPaymentDiscountPct')
      ? num(formData.get('earlyPaymentDiscountPct'))
      : undefined,
    lateFeePctPerMonth: formData.get('lateFeePctPerMonth')
      ? num(formData.get('lateFeePctPerMonth'))
      : undefined,
    effectiveFrom: n(formData.get('effectiveFrom')),
    effectiveTo: n(formData.get('effectiveTo')) || undefined,
    notes: n(formData.get('notes')) || undefined,
  });

  const approval = await submitApproval({
    entityId: ctx.entityId,
    approvalType: 'buyer_credit_limit',
    sourceModule: 'buyer-credit-limits',
    title: `Set credit limit ${Number(parsed.creditLimitPkr).toFixed(2)} PKR for buyer`,
    amountPkr: Number(parsed.creditLimitPkr),
    payload: { ...parsed },
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  await db
    .update(buyerCreditLimits)
    .set({ isActive: false, effectiveTo: parsed.effectiveFrom })
    .where(
      and(
        eq(buyerCreditLimits.entityId, ctx.entityId),
        eq(buyerCreditLimits.buyerId, parsed.buyerId),
        eq(buyerCreditLimits.isActive, true),
      ),
    );

  await db.insert(buyerCreditLimits).values({
    entityId: parsed.entityId,
    buyerId: parsed.buyerId,
    creditLimitPkr: Number(parsed.creditLimitPkr).toFixed(2),
    paymentTermsDays: parsed.paymentTermsDays,
    earlyPaymentDiscountPct: parsed.earlyPaymentDiscountPct?.toString() ?? null,
    lateFeePctPerMonth: parsed.lateFeePctPerMonth?.toString() ?? null,
    effectiveFrom: parsed.effectiveFrom,
    effectiveTo: parsed.effectiveTo,
    notes: parsed.notes,
    approvalRequestId: approval.id,
    isActive: true,
  });

  revalidatePath('/finance/ar/credit-limits');
}

export async function raiseArDispute(formData: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('Not authenticated');

  const evidenceRaw = formData.getAll('evidenceUrls').map(String).filter(Boolean);
  const parsed = arDisputeCreateSchema.parse({
    invoiceId: n(formData.get('invoiceId')),
    raisedOn: n(formData.get('raisedOn')),
    raisedByBuyer: n(formData.get('raisedByBuyer')) || undefined,
    disputeKind: n(formData.get('disputeKind')) as
      | 'quantity_short' | 'quality_issue' | 'wrong_amount' | 'duplicate_billing'
      | 'already_paid' | 'contract_breach' | 'other',
    disputedAmountPkr: n(formData.get('disputedAmountPkr')) || undefined,
    description: n(formData.get('description')),
    evidenceUrls: evidenceRaw,
  });

  await db.insert(arDisputes).values({
    invoiceId: parsed.invoiceId,
    raisedOn: parsed.raisedOn,
    raisedByBuyer: parsed.raisedByBuyer,
    disputeKind: parsed.disputeKind,
    disputedAmountPkr: parsed.disputedAmountPkr ? Number(parsed.disputedAmountPkr).toFixed(2) : null,
    description: parsed.description,
    evidenceUrls: parsed.evidenceUrls,
    status: 'open',
  });

  await db.update(arInvoices).set({ status: 'disputed', updatedAt: sql`now()` }).where(eq(arInvoices.id, parsed.invoiceId));

  revalidatePath('/finance/ar/disputes');
}

export async function resolveArDispute(formData: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('Not authenticated');

  const parsed = arDisputeResolveSchema.parse({
    disputeId: n(formData.get('disputeId')),
    status: n(formData.get('status')) as 'resolved' | 'escalated_to_legal' | 'withdrawn' | 'written_off',
    resolution: n(formData.get('resolution')),
    resolutionAmountPkr: n(formData.get('resolutionAmountPkr')) || undefined,
    resolvedOn: n(formData.get('resolvedOn')),
  });

  const [d] = await db.select().from(arDisputes).where(eq(arDisputes.id, parsed.disputeId)).limit(1);
  if (!d) throw new Error('Dispute not found');

  const approval = await submitApproval({
    entityId: ctx.entityId,
    approvalType: parsed.status === 'written_off' ? 'ar_write_off' : 'ar_dispute_resolution',
    sourceModule: 'ar-disputes',
    sourceRecordId: d.id,
    title: `Dispute resolution: ${parsed.status}`,
    amountPkr: parsed.resolutionAmountPkr ? Number(parsed.resolutionAmountPkr) : undefined,
    payload: { ...parsed },
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  await db
    .update(arDisputes)
    .set({
      status: parsed.status,
      resolution: parsed.resolution,
      resolutionAmountPkr: parsed.resolutionAmountPkr
        ? Number(parsed.resolutionAmountPkr).toFixed(2)
        : null,
      resolvedOn: parsed.resolvedOn,
      resolvedBy: ctx.userId,
      approvalRequestId: approval.id,
    })
    .where(eq(arDisputes.id, parsed.disputeId));

  if (parsed.status === 'written_off') {
    const writeOffAmount = parsed.resolutionAmountPkr ? Number(parsed.resolutionAmountPkr) : 0;
    if (writeOffAmount > 0) {
      const journalNumber = await nextVoucherNumber(ctx.entityId, 'journal');
      await postJournal({
        entityId: ctx.entityId,
        postedOn: parsed.resolvedOn,
        narration: `AR write-off for dispute ${d.id}`,
        sourceModule: 'ar-disputes',
        sourceRecordId: d.id,
        approvalRequestId: approval.id,
        postedBy: ctx.userId,
        journalNumber,
        lines: [
          { accountCode: '6900', debitPkr: writeOffAmount, narration: 'Bad debt expense' },
          { accountCode: '1200', creditPkr: writeOffAmount, narration: 'Write off receivable' },
        ],
      });
      const [inv] = await db.select().from(arInvoices).where(eq(arInvoices.id, d.invoiceId)).limit(1);
      if (inv) {
        const newOutstanding = Math.max(0, Number(inv.outstandingPkr) - writeOffAmount);
        await db
          .update(arInvoices)
          .set({
            outstandingPkr: newOutstanding.toFixed(2),
            status: newOutstanding <= 0.005 ? 'written_off' : inv.status,
            updatedAt: sql`now()`,
          })
          .where(eq(arInvoices.id, inv.id));
      }
    }
  } else if (parsed.status === 'resolved' || parsed.status === 'withdrawn') {
    const [inv] = await db.select().from(arInvoices).where(eq(arInvoices.id, d.invoiceId)).limit(1);
    if (inv) {
      const next =
        Number(inv.outstandingPkr) <= 0.005
          ? 'paid'
          : Number(inv.paidPkr) > 0
          ? 'partial'
          : 'open';
      await db.update(arInvoices).set({ status: next, updatedAt: sql`now()` }).where(eq(arInvoices.id, inv.id));
    }
  }

  revalidatePath('/finance/ar/disputes');
}
