'use server';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  rfqCreateSchema,
  rfqQuoteSubmitSchema,
  rfqSelectWinnerSchema,
  rfqSendInvitationsSchema,
  rfqInboundQuoteSchema,
  DEFAULT_APPROVAL_THRESHOLDS_PKR,
  sendTextMessage,
} from '@zameen/shared';
import {
  db,
  rfqs,
  rfqLineItems,
  rfqInvitations,
  rfqQuotes,
  vendors,
  purchaseOrders,
} from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

function genRfqNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  return `RFQ-${y}${m}-${Date.now().toString().slice(-6)}`;
}

function genReplyToken(): string {
  return randomBytes(18).toString('base64url');
}

export async function createRfq(raw: unknown): Promise<Result> {
  const parsed = rfqCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const rfqNumber = genRfqNumber();

  const [rfqRow] = await db
    .insert(rfqs)
    .values({
      entityId: data.entityId,
      rfqNumber,
      title: data.title,
      description: data.description ?? null,
      category: data.category,
      neededBy: data.neededBy ?? null,
      fieldId: data.fieldId ?? null,
      cropPlanId: data.cropPlanId ?? null,
      budgetEstimatePkr: data.budgetEstimatePkr != null ? data.budgetEstimatePkr.toFixed(2) : null,
      status: 'draft',
      createdBy: ctx.userId,
    })
    .returning();

  if (data.lineItems.length > 0) {
    await db.insert(rfqLineItems).values(
      data.lineItems.map((li, idx) => ({
        rfqId: rfqRow!.id,
        description: li.description,
        quantity: li.quantity.toString(),
        unit: li.unit,
        specifications: li.specifications ?? null,
        orderIndex: idx,
      })),
    );
  }

  if (data.invitedVendorIds.length > 0) {
    await db.insert(rfqInvitations).values(
      data.invitedVendorIds.map((vid) => ({
        rfqId: rfqRow!.id,
        vendorId: vid,
        replyToken: genReplyToken(),
      })),
    );
  }

  revalidatePath('/procurement/rfqs');
  return { ok: true, id: rfqRow!.id };
}

export async function sendInvitations(raw: unknown): Promise<Result> {
  const parsed = rfqSendInvitationsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const { rfqId } = parsed.data;

  const [rfqRow] = await db.select().from(rfqs).where(eq(rfqs.id, rfqId)).limit(1);
  if (!rfqRow) return { ok: false, error: 'RFQ not found' };

  const invs = await db
    .select()
    .from(rfqInvitations)
    .where(and(eq(rfqInvitations.rfqId, rfqId)));

  const vendorIds = invs.map((i) => i.vendorId);
  const vendorRows = vendorIds.length
    ? await db.select().from(vendors).where(inArray(vendors.id, vendorIds))
    : [];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agri.feerasta.ai';
  const now = new Date();

  for (const inv of invs) {
    if (inv.sentAt) continue;
    const vendor = vendorRows.find((v) => v.id === inv.vendorId);
    if (!vendor?.phone) continue;
    const link = `${baseUrl}/api/procurement/rfq-reply?t=${inv.replyToken ?? ''}`;
    const body =
      `RFQ ${rfqRow.rfqNumber} (${rfqRow.title}). ` +
      `Needed by: ${rfqRow.neededBy ?? 'TBD'}. ` +
      `Reply with your quote: ${link}`;
    try {
      await sendTextMessage({ to: vendor.phone, body });
    } catch {
      // Non-fatal; mark not sent so retry possible.
      continue;
    }
    await db
      .update(rfqInvitations)
      .set({ sentAt: now })
      .where(eq(rfqInvitations.id, inv.id));
  }

  await db
    .update(rfqs)
    .set({ status: 'sent', updatedAt: now })
    .where(eq(rfqs.id, rfqId));

  revalidatePath(`/procurement/rfqs/${rfqId}`);
  return { ok: true, id: rfqId };
}

export async function submitRfqQuote(raw: unknown): Promise<Result> {
  const parsed = rfqQuoteSubmitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;

  const [quote] = await db
    .insert(rfqQuotes)
    .values({
      rfqId: data.rfqId,
      vendorId: data.vendorId,
      totalPkr: data.totalPkr.toString(),
      paymentTerms: data.paymentTerms ?? null,
      deliveryLeadDays: data.deliveryLeadDays ?? null,
      validityDays: data.validityDays ?? null,
      notes: data.notes ?? null,
      quoteDocUrl: data.quoteDocUrl ?? null,
      linePrices: data.linePrices,
    })
    .returning();

  const now = new Date();
  await db
    .update(rfqInvitations)
    .set({ respondedAt: now })
    .where(and(eq(rfqInvitations.rfqId, data.rfqId), eq(rfqInvitations.vendorId, data.vendorId)));

  await db
    .update(rfqs)
    .set({ status: 'quotes_received', updatedAt: now })
    .where(eq(rfqs.id, data.rfqId));

  revalidatePath(`/procurement/rfqs/${data.rfqId}`);
  return { ok: true, id: quote!.id };
}

export async function submitRfqQuoteByToken(raw: unknown): Promise<Result> {
  const parsed = rfqInboundQuoteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;

  const [inv] = await db
    .select()
    .from(rfqInvitations)
    .where(eq(rfqInvitations.replyToken, data.replyToken))
    .limit(1);
  if (!inv) return { ok: false, error: 'Invalid or expired reply token' };

  return submitRfqQuote({
    rfqId: inv.rfqId,
    vendorId: inv.vendorId,
    totalPkr: data.totalPkr,
    paymentTerms: data.paymentTerms,
    deliveryLeadDays: data.deliveryLeadDays,
    validityDays: data.validityDays,
    notes: data.notes,
    quoteDocUrl: data.quoteDocUrl,
    linePrices: data.linePrices,
  });
}

export async function selectRfqWinner(raw: unknown): Promise<Result> {
  const parsed = rfqSelectWinnerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [rfqRow] = await db.select().from(rfqs).where(eq(rfqs.id, data.rfqId)).limit(1);
  if (!rfqRow) return { ok: false, error: 'RFQ not found' };
  const [quote] = await db.select().from(rfqQuotes).where(eq(rfqQuotes.id, data.quoteId)).limit(1);
  if (!quote || quote.rfqId !== data.rfqId) return { ok: false, error: 'Quote not on this RFQ' };
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, quote.vendorId)).limit(1);

  const reasonText = typeof data.selectionReason === 'string' ? data.selectionReason : data.selectionReason;
  const fullReason = data.reasonNote ? `${reasonText}: ${data.reasonNote}` : reasonText;

  // Clear previous winner flag, mark new one.
  await db.update(rfqQuotes).set({ isWinner: false }).where(eq(rfqQuotes.rfqId, data.rfqId));
  await db.update(rfqQuotes).set({ isWinner: true }).where(eq(rfqQuotes.id, data.quoteId));

  const amountPkr = Number(quote.totalPkr);
  const thresholds = DEFAULT_APPROVAL_THRESHOLDS_PKR.vendor_selection;
  const needsApproval =
    (thresholds.supervisor !== null && amountPkr > thresholds.supervisor) ||
    (thresholds.farm_manager !== null && amountPkr > thresholds.farm_manager);

  const payload = {
    rfqId: rfqRow.id,
    rfqNumber: rfqRow.rfqNumber,
    quoteId: quote.id,
    vendorId: quote.vendorId,
    vendorName: vendor?.name,
    totalPkr: amountPkr,
    selectionReason: fullReason,
  };

  let approvalId: string | undefined;
  if (needsApproval) {
    const contextSnapshot = await buildFullContext({
      entityId: rfqRow.entityId,
      approvalType: 'vendor_selection',
      payload,
      requesterUserId: ctx.userId,
      sourceModule: 'procurement',
    });
    const reqRow = await submitApproval({
      entityId: rfqRow.entityId,
      approvalType: 'vendor_selection',
      sourceModule: 'procurement',
      sourceRecordId: rfqRow.id,
      title: `RFQ ${rfqRow.rfqNumber} - select ${vendor?.name ?? 'vendor'}`,
      amountPkr,
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
    approvalId = reqRow.id;
  }

  await db
    .update(rfqs)
    .set({
      selectedQuoteId: data.quoteId,
      selectionReason: fullReason,
      approvalRequestId: approvalId ?? null,
      status: 'selected',
      updatedAt: new Date(),
    })
    .where(eq(rfqs.id, data.rfqId));

  // Auto-create purchase order skeleton (pending_approval).
  const lineItems = await db.select().from(rfqLineItems).where(eq(rfqLineItems.rfqId, data.rfqId));
  const linePrices = quote.linePrices ?? [];
  const poLines = lineItems.map((li) => {
    const lp = linePrices.find((p) => p.lineItemId === li.id);
    const unitPricePkr = lp?.unitPricePkr ?? 0;
    return {
      description: li.description,
      qty: Number(li.quantity),
      unit: li.unit,
      unitPricePkr,
    };
  });
  const subtotal = poLines.reduce((s, l) => s + l.qty * l.unitPricePkr, 0);
  const poNumber = `PO-${Date.now()}`;
  const [po] = await db
    .insert(purchaseOrders)
    .values({
      entityId: rfqRow.entityId,
      poNumber,
      vendorId: quote.vendorId,
      poDate: new Date().toISOString().slice(0, 10),
      lines: poLines,
      subtotalPkr: subtotal.toFixed(2),
      taxPkr: '0',
      totalPkr: amountPkr.toFixed(2),
      status: needsApproval ? 'pending_approval' : 'approved',
      approvalRequestId: approvalId ?? null,
      createdBy: ctx.userId,
    })
    .returning();

  await db
    .update(rfqs)
    .set({ purchaseOrderId: po!.id, updatedAt: new Date() })
    .where(eq(rfqs.id, data.rfqId));

  revalidatePath(`/procurement/rfqs/${data.rfqId}`);
  return { ok: true, id: data.rfqId };
}
