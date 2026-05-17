'use server';
import { revalidatePath } from 'next/cache';
import { repairRequestSchema, repairQuoteSchema, repairQuoteSelectionSchema, repairWorkOrderClosureSchema } from '@zameen/shared/validators';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { db, repairRequests, repairQuotes, repairWorkOrders } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

function nextNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function submitRepairRequest(raw: unknown): Promise<Result> {
  const parsed = repairRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(repairRequests)
    .values({
      entityId: data.entityId,
      assetId: data.assetId,
      requestNumber: nextNumber('RR'),
      reportedBy: ctx.userId,
      issueDescription: data.issueDescription,
      issueDescriptionUr: data.issueDescriptionUr ?? null,
      severity: data.severity,
      suggestedAction: data.suggestedAction ?? null,
      problemPhotoUrls: data.problemPhotoUrls,
      status: 'quotes_pending',
    })
    .returning();

  revalidatePath('/repairs');
  return { ok: true, id: row!.id };
}

export async function submitRepairQuote(raw: unknown): Promise<Result> {
  const parsed = repairQuoteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const [row] = await db
    .insert(repairQuotes)
    .values({
      repairRequestId: data.repairRequestId,
      workshopName: data.workshopName,
      workshopContact: data.workshopContact ?? null,
      workshopLocation: data.workshopLocation ?? null,
      partsList: data.partsList,
      partsTotalPkr: data.partsTotalPkr.toString(),
      laborTotalPkr: data.laborTotalPkr.toString(),
      totalQuotePkr: data.totalQuotePkr.toString(),
      etaDays: data.etaDays?.toString() ?? null,
      warrantyDays: data.warrantyDays?.toString() ?? null,
      quoteDocumentUrls: data.quoteDocumentUrls,
      ocrExtractedText: data.ocrExtractedText ?? null,
    })
    .returning();
  revalidatePath(`/repairs/${data.repairRequestId}`);
  return { ok: true, id: row!.id };
}

export async function selectRepairQuote(raw: unknown): Promise<Result> {
  const parsed = repairQuoteSelectionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  await db.update(repairQuotes).set({ selected: false }).where(eq(repairQuotes.repairRequestId, data.repairRequestId));
  const [quote] = await db
    .update(repairQuotes)
    .set({ selected: true, selectionReason: data.selectionReasonText ?? data.selectionReason })
    .where(eq(repairQuotes.id, data.selectedQuoteId))
    .returning();

  const [req] = await db
    .update(repairRequests)
    .set({ selectedQuoteId: data.selectedQuoteId, status: 'approval_pending', updatedAt: new Date() })
    .where(eq(repairRequests.id, data.repairRequestId))
    .returning();

  const amountPkr = Number(quote!.totalQuotePkr);
  const thresholds = DEFAULT_APPROVAL_THRESHOLDS_PKR.repair;
  const needsApproval =
    (thresholds.supervisor !== null && amountPkr > thresholds.supervisor) ||
    (thresholds.farm_manager !== null && amountPkr > thresholds.farm_manager);

  if (needsApproval) {
    const payload = {
      repairRequestId: req!.id,
      selectedQuoteId: quote!.id,
      quote,
      workshopName: quote!.workshopName,
    };
    const contextSnapshot = await buildFullContext({
      entityId: req!.entityId,
      approvalType: 'repair',
      payload,
      requesterUserId: ctx.userId,
      sourceModule: 'repair',
    });
    await submitApproval({
      entityId: req!.entityId,
      approvalType: 'repair',
      sourceModule: 'repair',
      sourceRecordId: req!.id,
      title: `Repair: ${req!.requestNumber} via ${quote!.workshopName}`,
      amountPkr,
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }

  revalidatePath(`/repairs/${data.repairRequestId}`);
  return { ok: true, id: req!.id };
}

export async function closeRepairWorkOrder(raw: unknown): Promise<Result> {
  const parsed = repairWorkOrderClosureSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const [wo] = await db
    .update(repairWorkOrders)
    .set({
      actualCompletionAt: new Date(data.actualCompletionAt),
      finalInvoicePkr: data.finalInvoicePkr.toString(),
      finalInvoicePhotoUrls: data.finalInvoicePhotoUrls,
      operatorSignoffBy: data.operatorSignoffBy,
      operatorSignoffPhotoUrl: data.operatorSignoffPhotoUrl ?? null,
      warrantyStart: new Date(data.actualCompletionAt),
      warrantyEnd: data.warrantyDays
        ? new Date(new Date(data.actualCompletionAt).getTime() + Number(data.warrantyDays) * 86_400_000)
        : null,
      notes: data.notes ?? null,
    })
    .where(eq(repairWorkOrders.id, data.workOrderId))
    .returning();
  return { ok: true, id: wo!.id };
}
