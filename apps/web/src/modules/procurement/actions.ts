'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  vendorCreateSchema,
  purchaseOrderCreateSchema,
  grnCreateSchema,
  purchaseInvoiceSchema,
  invoicePaymentSchema,
} from '@zameen/shared/validators';
import {
  db,
  vendors,
  purchaseOrders,
  goodsReceivedNotes,
  purchaseInvoices,
} from '@zameen/db';
import { submitApproval } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

export async function createVendor(raw: unknown): Promise<R> {
  const parsed = vendorCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const [row] = await db
    .insert(vendors)
    .values({
      entityId: data.entityId,
      code: data.code,
      name: data.name,
      nameUr: data.nameUr ?? null,
      category: data.category ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      ntn: data.ntn ?? null,
      creditTermsDays: data.creditTermsDays.toString(),
    })
    .returning();
  revalidatePath('/procurement/vendors');
  return { ok: true, id: row!.id };
}

export async function createPurchaseOrder(raw: unknown): Promise<R> {
  const parsed = purchaseOrderCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const poNumber = `PO-${Date.now()}`;
  const [row] = await db
    .insert(purchaseOrders)
    .values({
      entityId: data.entityId,
      poNumber,
      vendorId: data.vendorId,
      poDate: data.poDate,
      expectedDeliveryDate: data.expectedDeliveryDate ?? null,
      lines: data.lines,
      subtotalPkr: data.subtotalPkr.toFixed(2),
      taxPkr: data.taxPkr.toFixed(2),
      totalPkr: data.totalPkr.toFixed(2),
      status: 'pending_approval',
      createdBy: ctx.userId,
    })
    .returning();

  await submitApproval({
    entityId: data.entityId,
    approvalType: 'input_purchase',
    sourceModule: 'procurement',
    sourceRecordId: row!.id,
    title: `Purchase order ${poNumber}`,
    amountPkr: data.totalPkr,
    payload: { purchaseOrderId: row!.id, ...data },
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  revalidatePath('/procurement/purchase-orders');
  return { ok: true, id: row!.id };
}

export async function createGoodsReceived(raw: unknown): Promise<R> {
  const parsed = grnCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const grnNumber = `GRN-${Date.now()}`;
  const [row] = await db
    .insert(goodsReceivedNotes)
    .values({
      purchaseOrderId: data.purchaseOrderId,
      grnNumber,
      receivedOn: data.receivedOn,
      receivedBy: ctx.userId,
      lines: data.lines,
      qualityCheckPassed: data.qualityCheckPassed,
      qcNotes: data.qcNotes ?? null,
      photoUrls: data.photoUrls,
    })
    .returning();

  await db
    .update(purchaseOrders)
    .set({ status: 'received' })
    .where(eq(purchaseOrders.id, data.purchaseOrderId));

  revalidatePath('/procurement/goods-received');
  return { ok: true, id: row!.id };
}

export async function createPurchaseInvoice(raw: unknown): Promise<R> {
  const parsed = purchaseInvoiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const [row] = await db
    .insert(purchaseInvoices)
    .values({
      entityId: data.entityId,
      purchaseOrderId: data.purchaseOrderId ?? null,
      vendorId: data.vendorId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate ?? null,
      subtotalPkr: data.subtotalPkr,
      taxPkr: data.taxPkr,
      totalPkr: data.totalPkr,
      invoicePhotoUrls: data.invoicePhotoUrls,
    })
    .returning();
  revalidatePath('/procurement/purchase-invoices');
  return { ok: true, id: row!.id };
}

export async function recordInvoicePayment(raw: unknown): Promise<R> {
  const parsed = invoicePaymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [inv] = await db
    .select()
    .from(purchaseInvoices)
    .where(eq(purchaseInvoices.id, data.invoiceId))
    .limit(1);
  if (!inv) return { ok: false, error: 'Invoice not found' };

  const amount = Number(data.amountPkr);
  const newPaid = Number(inv.paidPkr) + amount;
  const status = newPaid >= Number(inv.totalPkr) ? 'paid' : 'partial';
  await db
    .update(purchaseInvoices)
    .set({ paidPkr: newPaid.toFixed(2), status })
    .where(eq(purchaseInvoices.id, data.invoiceId));

  if (amount > 50_000) {
    await submitApproval({
      entityId: inv.entityId,
      approvalType: 'input_purchase',
      sourceModule: 'procurement',
      sourceRecordId: inv.id,
      title: `Invoice payment ${inv.invoiceNumber}`,
      amountPkr: amount,
      payload: { invoiceId: inv.id, paymentMethod: data.paymentMethod },
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }

  revalidatePath(`/procurement/purchase-invoices/${data.invoiceId}`);
  return { ok: true, id: data.invoiceId };
}
