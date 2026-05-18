import { eq, and } from 'drizzle-orm';
import {
  db,
  journalEntries,
  journalLines,
  accounts,
  payslips,
  payrollRuns,
  workers,
  mandiDispatches,
  mandiSettlements,
  arhtis,
  produceLots,
  goodsReceivedNotes,
  purchaseOrders,
  vendors,
  purchaseInvoices,
  dieselPurchases,
} from '@zameen/db';

export interface JournalLineView {
  accountCode: string;
  accountName: string;
  debitPkr: string;
  creditPkr: string;
  narration: string | null;
}

export interface JournalVoucherView {
  id: string;
  journalNumber: string;
  postedOn: string;
  narration: string;
  totalDebitPkr: string;
  totalCreditPkr: string;
  entityId: string;
  lines: JournalLineView[];
}

export async function loadJournalVoucher(id: string): Promise<JournalVoucherView | null> {
  const [j] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
  if (!j) return null;
  const lines = await db
    .select({
      debitPkr: journalLines.debitPkr,
      creditPkr: journalLines.creditPkr,
      narration: journalLines.narration,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(eq(journalLines.journalEntryId, j.id));
  return {
    id: j.id,
    journalNumber: j.journalNumber,
    postedOn: j.postedOn,
    narration: j.narration,
    totalDebitPkr: j.totalDebitPkr,
    totalCreditPkr: j.totalCreditPkr,
    entityId: j.entityId,
    lines: lines.map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debitPkr: l.debitPkr,
      creditPkr: l.creditPkr,
      narration: l.narration,
    })),
  };
}

/**
 * Classify a journal entry into voucher kind by inspecting touched accounts.
 * 1000 = Cash on hand; 1010 = Bank.
 */
export function classifyJournalVoucher(
  j: JournalVoucherView,
): 'cash-receipt' | 'cash-payment' | 'bank-receipt' | 'bank-payment' | 'journal' {
  const cashDr = j.lines.some((l) => l.accountCode === '1000' && Number(l.debitPkr) > 0);
  const cashCr = j.lines.some((l) => l.accountCode === '1000' && Number(l.creditPkr) > 0);
  const bankDr = j.lines.some((l) => l.accountCode === '1010' && Number(l.debitPkr) > 0);
  const bankCr = j.lines.some((l) => l.accountCode === '1010' && Number(l.creditPkr) > 0);
  if (cashDr) return 'cash-receipt';
  if (cashCr) return 'cash-payment';
  if (bankDr) return 'bank-receipt';
  if (bankCr) return 'bank-payment';
  return 'journal';
}

export interface PayslipView {
  id: string;
  periodStart: string;
  periodEnd: string;
  entityId: string;
  workerName: string;
  workerNameUr: string | null;
  workerCode: string;
  cnicLast4: string | null;
  daysWorked: string;
  baseSalaryPkr: string;
  pieceRateEarningsPkr: string;
  deductionsPkr: string;
  advancesPkr: string;
  netPkr: string;
}

export async function loadPayslip(id: string): Promise<PayslipView | null> {
  const [row] = await db
    .select({
      slip: payslips,
      run: payrollRuns,
      worker: workers,
    })
    .from(payslips)
    .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
    .innerJoin(workers, eq(payslips.workerId, workers.id))
    .where(eq(payslips.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.slip.id,
    periodStart: row.run.periodStart,
    periodEnd: row.run.periodEnd,
    entityId: row.run.entityId,
    workerName: row.worker.fullName,
    workerNameUr: row.worker.fullNameUr,
    workerCode: row.worker.code,
    cnicLast4: row.worker.cnicLast4,
    daysWorked: row.slip.daysWorked,
    baseSalaryPkr: row.slip.baseSalaryPkr,
    pieceRateEarningsPkr: row.slip.pieceRateEarningsPkr,
    deductionsPkr: row.slip.deductionsPkr,
    advancesPkr: row.slip.advancesPkr,
    netPkr: row.slip.netPkr,
  };
}

export interface MandiPattiView {
  settlementId: string;
  dispatchNumber: string;
  entityId: string;
  dispatchedOn: string;
  settledOn: string;
  arhtiName: string | null;
  mandiLocation: string | null;
  produceLotCode: string | null;
  netWeightKg: string;
  bagsCount: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  grossPricePkr: string;
  commissionPkr: string;
  loadingPkr: string | null;
  weighingPkr: string | null;
  otherDeductionsPkr: string | null;
  freightPkr: string | null;
  netReceivedPkr: string;
}

export async function loadMandiPatti(settlementId: string): Promise<MandiPattiView | null> {
  const [row] = await db
    .select({
      s: mandiSettlements,
      d: mandiDispatches,
      a: arhtis,
      p: produceLots,
    })
    .from(mandiSettlements)
    .innerJoin(mandiDispatches, eq(mandiSettlements.mandiDispatchId, mandiDispatches.id))
    .leftJoin(arhtis, eq(mandiDispatches.arhtiId, arhtis.id))
    .leftJoin(produceLots, eq(mandiDispatches.produceLotId, produceLots.id))
    .where(eq(mandiSettlements.id, settlementId))
    .limit(1);
  if (!row) return null;
  return {
    settlementId: row.s.id,
    dispatchNumber: row.d.dispatchNumber,
    entityId: row.d.entityId,
    dispatchedOn: row.d.dispatchedOn,
    settledOn: row.s.settledOn,
    arhtiName: row.a?.name ?? null,
    mandiLocation: row.a?.mandiLocation ?? null,
    produceLotCode: row.p?.lotNumber ?? null,
    netWeightKg: row.d.netWeightKg,
    bagsCount: row.d.bagsCount,
    vehicleNumber: row.d.vehicleNumber,
    driverName: row.d.driverName,
    grossPricePkr: row.s.grossPricePkr,
    commissionPkr: row.s.commissionPkr,
    loadingPkr: row.s.loadingPkr,
    weighingPkr: row.s.weighingPkr,
    otherDeductionsPkr: row.s.otherDeductionsPkr,
    freightPkr: row.d.freightPkr,
    netReceivedPkr: row.s.netReceivedPkr,
  };
}

export interface GrnLineView {
  itemName: string;
  quantity: number | string;
  unit: string;
  condition?: string;
  qcStatus?: string;
}

export interface GrnView {
  id: string;
  grnNumber: string;
  entityId: string;
  receivedOn: string;
  qcPassed: boolean;
  qcNotes: string | null;
  photoUrls: string[];
  poNumber: string;
  vendorName: string;
  vendorAddress: string | null;
  lines: GrnLineView[];
}

export async function loadGrn(id: string): Promise<GrnView | null> {
  const [row] = await db
    .select({ g: goodsReceivedNotes, po: purchaseOrders, v: vendors })
    .from(goodsReceivedNotes)
    .innerJoin(purchaseOrders, eq(goodsReceivedNotes.purchaseOrderId, purchaseOrders.id))
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .where(eq(goodsReceivedNotes.id, id))
    .limit(1);
  if (!row) return null;
  const rawLines = Array.isArray(row.g.lines) ? (row.g.lines as Array<Record<string, unknown>>) : [];
  return {
    id: row.g.id,
    grnNumber: row.g.grnNumber,
    entityId: row.po.entityId,
    receivedOn: row.g.receivedOn,
    qcPassed: row.g.qualityCheckPassed,
    qcNotes: row.g.qcNotes,
    photoUrls: Array.isArray(row.g.photoUrls) ? row.g.photoUrls : [],
    poNumber: row.po.poNumber,
    vendorName: row.v.name,
    vendorAddress: row.v.address,
    lines: rawLines.map((l) => ({
      itemName: String(l.itemName ?? l.name ?? '-'),
      quantity: (l.quantity as number | string) ?? 0,
      unit: String(l.unit ?? '-'),
      condition: l.condition ? String(l.condition) : undefined,
      qcStatus: l.qcStatus ? String(l.qcStatus) : undefined,
    })),
  };
}

export interface PurchaseInvoiceView {
  id: string;
  entityId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  vendorName: string;
  vendorAddress: string | null;
  vendorNtn: string | null;
  poNumber: string | null;
  subtotalPkr: string;
  taxPkr: string;
  totalPkr: string;
  paidPkr: string;
  status: string;
}

export async function loadPurchaseInvoice(id: string): Promise<PurchaseInvoiceView | null> {
  const [row] = await db
    .select({ inv: purchaseInvoices, v: vendors, po: purchaseOrders })
    .from(purchaseInvoices)
    .innerJoin(vendors, eq(purchaseInvoices.vendorId, vendors.id))
    .leftJoin(purchaseOrders, eq(purchaseInvoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseInvoices.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.inv.id,
    entityId: row.inv.entityId,
    invoiceNumber: row.inv.invoiceNumber,
    invoiceDate: row.inv.invoiceDate,
    dueDate: row.inv.dueDate,
    vendorName: row.v.name,
    vendorAddress: row.v.address,
    vendorNtn: row.v.ntn,
    poNumber: row.po?.poNumber ?? null,
    subtotalPkr: row.inv.subtotalPkr,
    taxPkr: row.inv.taxPkr,
    totalPkr: row.inv.totalPkr,
    paidPkr: row.inv.paidPkr,
    status: row.inv.status,
  };
}

export interface DieselPurchaseView {
  id: string;
  entityId: string;
  purchasedAt: Date;
  vendorName: string;
  vendorLocation: string | null;
  quantityLiters: string;
  rateLiterPkr: string;
  totalPkr: string;
  paymentMethod: string;
  receiptPhotoUrls: string[];
  approvalRequestId: string | null;
  notes: string | null;
}

export async function loadDieselPurchase(id: string): Promise<DieselPurchaseView | null> {
  const [row] = await db.select().from(dieselPurchases).where(eq(dieselPurchases.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    entityId: row.entityId,
    purchasedAt: row.purchasedAt,
    vendorName: row.vendorName,
    vendorLocation: row.vendorLocation,
    quantityLiters: row.quantityLiters,
    rateLiterPkr: row.rateLiterPkr,
    totalPkr: row.totalPkr,
    paymentMethod: row.paymentMethod,
    receiptPhotoUrls: Array.isArray(row.receiptPhotoUrls) ? row.receiptPhotoUrls : [],
    approvalRequestId: row.approvalRequestId,
    notes: row.notes,
  };
}

// Suppress unused
void and;
