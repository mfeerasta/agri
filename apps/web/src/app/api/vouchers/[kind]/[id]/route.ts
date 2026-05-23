/**
 * Voucher PDF render route.
 *
 *   GET /api/vouchers/cash-receipt/:id
 *   GET /api/vouchers/cash-payment/:id
 *   GET /api/vouchers/journal/:id
 *   GET /api/vouchers/payslip/:id
 *   GET /api/vouchers/mandi-patti/:id
 *   GET /api/vouchers/grn/:id
 *
 * Streams a print-ready A4 PDF rendered via @react-pdf/renderer. Auth is via
 * the Supabase server client (cookie-based session). Each handler resolves
 * the underlying record, ensures it is scoped to the caller's entity, and
 * passes a fully populated props object to the matching voucher template.
 */

import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { and, eq } from 'drizzle-orm';
import {
  db,
  entities,
  journalEntries,
  journalLines,
  accounts,
  payslips,
  payrollRuns,
  workers,
  mandiSettlements,
  mandiDispatches,
  produceLots,
  arhtis,
  goodsReceivedNotes,
  purchaseOrders,
  vendors,
} from '@zameen/db';
import {
  CashReceiptVoucher,
  CashPaymentVoucher,
  JournalVoucher,
  WorkerPayslip,
  MandiPatti,
  GrnGoodsReceiptNote,
  type JournalVoucherLine,
  type GrnLine,
} from '@zameen/finance';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type VoucherKind = 'cash-receipt' | 'cash-payment' | 'journal' | 'payslip' | 'mandi-patti' | 'grn';

const ALLOWED: ReadonlySet<VoucherKind> = new Set(['cash-receipt', 'cash-payment', 'journal', 'payslip', 'mandi-patti', 'grn']);

interface RouteContext {
  params: Promise<{ kind: string; id: string }>;
}

interface JournalLineRow {
  accountId: string;
  debitPkr: string;
  creditPkr: string;
  narration: string | null;
}

interface GrnLineJson {
  itemName?: string;
  itemNameUr?: string;
  unit?: string;
  qtyOrdered?: number;
  qtyReceived?: number;
  ratePerUnitRupees?: number;
}

interface PoLineJson {
  itemName?: string;
  itemNameUr?: string;
  unit?: string;
  qty?: number;
  qtyOrdered?: number;
  ratePerUnitRupees?: number;
  ratePerUnitPkr?: number;
}

async function loadEntity(entityId: string): Promise<{ name: string; nameUr: string | null } | null> {
  const [row] = await db
    .select({ name: entities.name })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  return row ? { name: row.name, nameUr: null } : null;
}

async function authedEntityId(): Promise<string | null> {
  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const entityId = (data.user.user_metadata as Record<string, unknown> | null)?.['entityId'];
  return typeof entityId === 'string' ? entityId : null;
}

async function renderPdfResponse(node: React.JSX.Element, filename: string): Promise<NextResponse> {
  const stream = await renderToStream(node);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new NextResponse(Buffer.concat(chunks), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { kind, id } = await ctx.params;
  if (!ALLOWED.has(kind as VoucherKind)) {
    return NextResponse.json({ error: 'unknown_voucher_kind' }, { status: 400 });
  }
  const entityId = await authedEntityId();
  if (!entityId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ent = await loadEntity(entityId);
  if (!ent) return NextResponse.json({ error: 'entity_not_found' }, { status: 404 });

  if (kind === 'journal' || kind === 'cash-receipt' || kind === 'cash-payment') {
    const [je] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.entityId, entityId)))
      .limit(1);
    if (!je) return NextResponse.json({ error: 'journal_not_found' }, { status: 404 });
    const lines = (await db.select().from(journalLines).where(eq(journalLines.journalEntryId, je.id))) as JournalLineRow[];
    const codes = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
    const acctById = new Map(codes.map((a) => [a.id, a] as const));

    const enrichedLines: JournalVoucherLine[] = lines.map((l) => {
      const a = acctById.get(l.accountId);
      return {
        accountCode: a?.code ?? '?',
        accountName: a?.name ?? 'Unknown',
        accountNameUr: a?.nameUr ?? undefined,
        debitRupees: Number(l.debitPkr),
        creditRupees: Number(l.creditPkr),
        narration: l.narration ?? undefined,
      };
    });

    const voucherNumber = je.voucherNumber ?? je.journalNumber;

    if (kind === 'journal') {
      const node = JournalVoucher({
        voucherNumber,
        entityName: ent.name,
        entityNameUr: ent.nameUr ?? undefined,
        postedOn: je.postedOn,
        lines: enrichedLines,
        narration: je.narration,
      });
      return renderPdfResponse(node, `journal-${voucherNumber}.pdf`);
    }

    const isReceipt = kind === 'cash-receipt';
    const cashLine = enrichedLines.find((l) => (l.accountCode === '1000' || l.accountCode === '1010') && (isReceipt ? l.debitRupees > 0 : l.creditRupees > 0));
    const counterLine = enrichedLines.find((l) => l !== cashLine && (isReceipt ? l.creditRupees > 0 : l.debitRupees > 0));
    if (!cashLine || !counterLine) return NextResponse.json({ error: 'voucher_shape_mismatch' }, { status: 422 });
    const amountRupees = isReceipt ? cashLine.debitRupees : cashLine.creditRupees;

    if (isReceipt) {
      const node = CashReceiptVoucher({
        voucherNumber,
        entityName: ent.name,
        entityNameUr: ent.nameUr ?? undefined,
        postedOn: je.postedOn,
        receivedFromName: counterLine.narration ?? counterLine.accountName,
        accountCreditedCode: counterLine.accountCode,
        accountCreditedName: counterLine.accountName,
        accountCreditedNameUr: counterLine.accountNameUr,
        amountRupees,
        narration: je.narration,
      });
      return renderPdfResponse(node, `${voucherNumber}.pdf`);
    }

    const node = CashPaymentVoucher({
      voucherNumber,
      entityName: ent.name,
      entityNameUr: ent.nameUr ?? undefined,
      postedOn: je.postedOn,
      paidToName: counterLine.narration ?? counterLine.accountName,
      accountDebitedCode: counterLine.accountCode,
      accountDebitedName: counterLine.accountName,
      accountDebitedNameUr: counterLine.accountNameUr,
      amountRupees,
      narration: je.narration,
    });
    return renderPdfResponse(node, `${voucherNumber}.pdf`);
  }

  if (kind === 'payslip') {
    const [ps] = await db.select().from(payslips).where(eq(payslips.id, id)).limit(1);
    if (!ps) return NextResponse.json({ error: 'payslip_not_found' }, { status: 404 });
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, ps.payrollRunId)).limit(1);
    if (!run || run.entityId !== entityId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const [w] = await db.select().from(workers).where(eq(workers.id, ps.workerId)).limit(1);
    if (!w) return NextResponse.json({ error: 'worker_not_found' }, { status: 404 });

    const base = Number(ps.baseSalaryPkr);
    const piece = Number(ps.pieceRateEarningsPkr);
    const gross = Number((base + piece).toFixed(2));
    const breakdown = (ps.breakdown ?? {}) as { daysAbsent?: number; daysLeave?: number };

    const node = WorkerPayslip({
      voucherNumber: `PSL-${ps.id.slice(0, 8).toUpperCase()}`,
      entityName: ent.name,
      entityNameUr: ent.nameUr ?? undefined,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      workerCode: w.code,
      workerName: w.fullName,
      workerNameUr: w.fullNameUr ?? undefined,
      cnicLast4: w.cnicLast4 ?? undefined,
      role: w.workerType,
      attendance: {
        daysPresent: Number(ps.daysWorked),
        daysAbsent: breakdown.daysAbsent ?? 0,
        daysLeave: breakdown.daysLeave ?? 0,
      },
      baseSalaryRupees: base,
      pieceRateRupees: piece,
      grossRupees: gross,
      deductionsRupees: Number(ps.deductionsPkr),
      advancesRupees: Number(ps.advancesPkr),
      netRupees: Number(ps.netPkr),
    });
    return renderPdfResponse(node, `payslip-${w.code}-${run.periodEnd}.pdf`);
  }

  if (kind === 'mandi-patti') {
    const [ms] = await db.select().from(mandiSettlements).where(eq(mandiSettlements.id, id)).limit(1);
    if (!ms) return NextResponse.json({ error: 'settlement_not_found' }, { status: 404 });
    const [md] = await db.select().from(mandiDispatches).where(eq(mandiDispatches.id, ms.mandiDispatchId)).limit(1);
    if (!md || md.entityId !== entityId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const [lot] = md.produceLotId
      ? await db.select().from(produceLots).where(eq(produceLots.id, md.produceLotId)).limit(1)
      : [null];
    const [arhti] = md.arhtiId
      ? await db.select().from(arhtis).where(eq(arhtis.id, md.arhtiId)).limit(1)
      : [null];

    const gross = Number(ms.grossPricePkr);
    const net = Number(ms.netReceivedPkr);
    const weightKg = Number(md.netWeightKg);
    const weightMann = Number((weightKg / 40).toFixed(2));
    const ratePerMann = weightMann > 0 ? Number((gross / weightMann).toFixed(2)) : 0;

    const deductions = [
      { label: 'Commission', labelUr: 'کمیشن', amountRupees: Number(ms.commissionPkr) },
      ...(ms.loadingPkr ? [{ label: 'Loading', labelUr: 'پلیداری', amountRupees: Number(ms.loadingPkr) }] : []),
      ...(ms.weighingPkr ? [{ label: 'Weighing', labelUr: 'تولائی', amountRupees: Number(ms.weighingPkr) }] : []),
      ...(ms.otherDeductionsPkr ? [{ label: 'Other', labelUr: 'دیگر', amountRupees: Number(ms.otherDeductionsPkr) }] : []),
    ];

    const node = MandiPatti({
      voucherNumber: `MP-${ms.id.slice(0, 8).toUpperCase()}`,
      entityName: ent.name,
      entityNameUr: ent.nameUr ?? undefined,
      lotNumber: lot?.lotNumber ?? md.dispatchNumber,
      cropName: lot?.cropName ?? 'Produce',
      mandiName: arhti?.mandiLocation ?? 'Mandi',
      arhtiName: arhti?.name,
      settledOn: ms.settledOn,
      weightMann,
      weightKg,
      ratePerMannRupees: ratePerMann,
      grossRupees: gross,
      deductions,
      netRupees: net,
    });
    return renderPdfResponse(node, `mandi-patti-${md.dispatchNumber}.pdf`);
  }

  if (kind === 'grn') {
    const [grn] = await db.select().from(goodsReceivedNotes).where(eq(goodsReceivedNotes.id, id)).limit(1);
    if (!grn) return NextResponse.json({ error: 'grn_not_found' }, { status: 404 });
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, grn.purchaseOrderId)).limit(1);
    if (!po || po.entityId !== entityId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, po.vendorId)).limit(1);

    const poLines = (po.lines ?? []) as PoLineJson[];
    const grnLinesJson = (grn.lines ?? []) as GrnLineJson[];
    const merged: GrnLine[] = grnLinesJson.map((g, i) => {
      const ordered = poLines[i];
      return {
        itemName: g.itemName ?? ordered?.itemName ?? 'Item',
        itemNameUr: g.itemNameUr ?? ordered?.itemNameUr,
        unit: g.unit ?? ordered?.unit ?? 'unit',
        qtyOrdered: Number(ordered?.qty ?? ordered?.qtyOrdered ?? g.qtyReceived ?? 0),
        qtyReceived: Number(g.qtyReceived ?? 0),
        ratePerUnitRupees: Number(g.ratePerUnitRupees ?? ordered?.ratePerUnitRupees ?? ordered?.ratePerUnitPkr ?? 0),
      };
    });

    const node = GrnGoodsReceiptNote({
      voucherNumber: grn.grnNumber,
      entityName: ent.name,
      entityNameUr: ent.nameUr ?? undefined,
      poNumber: po.poNumber,
      vendorName: vendor?.name ?? 'Vendor',
      vendorNameUr: vendor?.nameUr ?? undefined,
      receivedOn: grn.receivedOn,
      warehouseName: 'Main Store',
      qualityCheckPassed: grn.qualityCheckPassed,
      qcNotes: grn.qcNotes ?? undefined,
      lines: merged,
    });
    return renderPdfResponse(node, `grn-${grn.grnNumber}.pdf`);
  }

  return NextResponse.json({ error: 'unhandled' }, { status: 500 });
}
