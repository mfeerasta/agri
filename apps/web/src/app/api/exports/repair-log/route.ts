import { and, eq, gte, lte, inArray, asc } from 'drizzle-orm';
import {
  db,
  repairRequests,
  repairQuotes,
  repairWorkOrders,
  assets,
} from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import {
  ReportShell,
  SimpleTable,
  SectionTitlePdf,
  fmtPdfMoney,
  fmtPdfDate,
  type ColumnSpec,
} from '@/lib/reports/report-template';
import { pdfResponse, badRequest, unauthorized, serverError } from '@/lib/reports/response';
import { buildPdfFilename } from '@/lib/reports/excel-template';
import { getEntityName, getUserDisplayName } from '@/lib/reports/entity';
import * as React from 'react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fmtPdfDate2(d: Date | string | null | undefined): string {
  return fmtPdfDate(d);
}

function pdfDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getSessionContext();
    if (!session) return unauthorized();
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase();
    if (format !== 'pdf') return badRequest('only pdf supported for repair log');
    if (!from || !to) return badRequest('from and to (YYYY-MM-DD) are required');

    const fromDt = new Date(from);
    const toDt = new Date(to);

    const reqs = await db
      .select()
      .from(repairRequests)
      .where(
        and(
          eq(repairRequests.entityId, session.entityId),
          gte(repairRequests.reportedAt, fromDt),
          lte(repairRequests.reportedAt, toDt),
        ),
      )
      .orderBy(asc(repairRequests.reportedAt));

    const reqIds = reqs.map((r) => r.id);
    const assetIds = Array.from(new Set(reqs.map((r) => r.assetId)));
    const [quotes, workOrders, assetRows] = await Promise.all([
      reqIds.length ? db.select().from(repairQuotes).where(inArray(repairQuotes.repairRequestId, reqIds)) : Promise.resolve([] as Array<typeof repairQuotes.$inferSelect>),
      reqIds.length ? db.select().from(repairWorkOrders).where(inArray(repairWorkOrders.repairRequestId, reqIds)) : Promise.resolve([] as Array<typeof repairWorkOrders.$inferSelect>),
      assetIds.length ? db.select().from(assets).where(inArray(assets.id, assetIds)) : Promise.resolve([] as Array<typeof assets.$inferSelect>),
    ]);
    const assetById = new Map(assetRows.map((a) => [a.id, a]));
    const quoteById = new Map(quotes.map((q) => [q.id, q]));
    const woByReq = new Map<string, typeof repairWorkOrders.$inferSelect>();
    for (const wo of workOrders) woByReq.set(wo.repairRequestId, wo);

    const cols: ColumnSpec[] = [
      { key: 'reqNo', label: 'Request', width: 9, mono: true },
      { key: 'reportedAt', label: 'Reported', width: 9 },
      { key: 'asset', label: 'Asset', width: 16 },
      { key: 'severity', label: 'Severity', width: 8 },
      { key: 'issue', label: 'Issue', width: 22 },
      { key: 'selectedShop', label: 'Selected workshop', width: 14 },
      { key: 'quoteAmt', label: 'Quote', width: 11, align: 'right' },
      { key: 'finalAmt', label: 'Final invoice', width: 11, align: 'right' },
    ];

    const rows = reqs.map((r) => {
      const asset = assetById.get(r.assetId);
      const sel = r.selectedQuoteId ? quoteById.get(r.selectedQuoteId) : undefined;
      const wo = woByReq.get(r.id);
      return {
        reqNo: r.requestNumber,
        reportedAt: pdfDate(r.reportedAt),
        asset: asset?.name ?? r.assetId.slice(0, 8),
        severity: r.severity,
        issue: r.issueDescription.length > 60 ? `${r.issueDescription.slice(0, 60)}…` : r.issueDescription,
        selectedShop: sel?.workshopName ?? '',
        quoteAmt: sel ? fmtPdfMoney(sel.totalQuotePkr) : '',
        finalAmt: wo?.finalInvoicePkr ? fmtPdfMoney(wo.finalInvoicePkr) : '',
      };
    });

    const totalQuote = reqs.reduce((s, r) => {
      const sel = r.selectedQuoteId ? quoteById.get(r.selectedQuoteId) : undefined;
      return s + (sel ? Number(sel.totalQuotePkr) : 0);
    }, 0);
    const totalFinal = reqs.reduce((s, r) => {
      const wo = woByReq.get(r.id);
      return s + (wo?.finalInvoicePkr ? Number(wo.finalInvoicePkr) : 0);
    }, 0);

    const period = `${from}-to-${to}`;
    const [entityName, generatedBy] = await Promise.all([
      getEntityName(session.entityId),
      getUserDisplayName(session.userId),
    ]);

    const doc = ReportShell({
      title: 'Repair log',
      entityName,
      period,
      generatedBy,
      orientation: 'landscape',
      children: React.createElement(
        React.Fragment,
        null,
        React.createElement(SectionTitlePdf, null, 'Repair requests'),
        React.createElement(SimpleTable, {
          columns: cols,
          rows,
          totals: {
            reqNo: '',
            reportedAt: '',
            asset: '',
            severity: '',
            issue: '',
            selectedShop: '',
            quoteAmt: fmtPdfMoney(totalQuote),
            finalAmt: fmtPdfMoney(totalFinal),
          },
          totalsLabel: 'TOTAL',
        }),
      ),
    });

    return pdfResponse(doc, buildPdfFilename('repair-log', period));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
