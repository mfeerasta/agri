import { eq, inArray } from 'drizzle-orm';
import { db, cropPlans, fields as fieldsTable, blocks as blocksTable } from '@zameen/db';
import { computeFieldPnL, type FieldPnL } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';
import { FieldPnlPdf } from '@/lib/reports/field-pnl-pdf';
import {
  newWorkbook,
  addBrandedHeader,
  applyTableHeader,
  addDataRow,
  addTotalsRow,
  workbookToBuffer,
  buildPdfFilename,
  buildXlsxFilename,
  MONEY_FORMAT,
  QTY_FORMAT,
  type ColumnDef,
} from '@/lib/reports/excel-template';
import { pdfResponse, xlsxResponse, badRequest, unauthorized, serverError } from '@/lib/reports/response';
import { getEntityName, getUserDisplayName } from '@/lib/reports/entity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getSessionContext();
    if (!session) return unauthorized();
    const url = new URL(req.url);
    const fieldId = url.searchParams.get('fieldId');
    const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase();
    if (format !== 'pdf' && format !== 'xlsx') return badRequest('format must be pdf or xlsx');

    // Determine target plans: single field if fieldId provided, else all plans in entity.
    let scopedFieldIds: string[];
    if (fieldId) {
      const [f] = await db.select().from(fieldsTable).where(eq(fieldsTable.id, fieldId)).limit(1);
      if (!f) return badRequest('field not found');
      const [b] = await db.select().from(blocksTable).where(eq(blocksTable.id, f.blockId)).limit(1);
      if (!b || b.entityId !== session.entityId) return unauthorized();
      scopedFieldIds = [fieldId];
    } else {
      const blocks = await db.select().from(blocksTable).where(eq(blocksTable.entityId, session.entityId));
      const blockIds = blocks.map((b) => b.id);
      if (blockIds.length === 0) {
        scopedFieldIds = [];
      } else {
        const flds = await db.select().from(fieldsTable).where(inArray(fieldsTable.blockId, blockIds));
        scopedFieldIds = flds.map((f) => f.id);
      }
    }

    const plans = scopedFieldIds.length
      ? await db.select().from(cropPlans).where(inArray(cropPlans.fieldId, scopedFieldIds))
      : [];

    const pnlsRaw = await Promise.all(plans.map((p) => computeFieldPnL(p.id)));
    const pnls = pnlsRaw.filter((p): p is FieldPnL => p !== null);

    const fieldRows = scopedFieldIds.length
      ? await db.select().from(fieldsTable).where(inArray(fieldsTable.id, scopedFieldIds))
      : [];
    const fieldCodeById: Record<string, string> = Object.fromEntries(fieldRows.map((f) => [f.id, f.code]));

    const poolSet = new Set<string>();
    for (const p of pnls) for (const k of Object.keys(p.costByPool)) poolSet.add(k);
    const costPools = Array.from(poolSet).sort();

    const period = fieldId ? `field ${fieldCodeById[fieldId] ?? fieldId.slice(0, 8)}` : 'all fields';
    const slug = fieldId ? `field-pnl-${fieldCodeById[fieldId] ?? fieldId.slice(0, 8)}` : 'field-pnl-all';
    const [entityName, generatedBy] = await Promise.all([
      getEntityName(session.entityId),
      getUserDisplayName(session.userId),
    ]);

    if (format === 'xlsx') {
      const wb = newWorkbook({
        reportTitle: 'Field P&L',
        entityName,
        period,
        generatedAt: new Date(),
        generatedBy,
      });
      const ws = wb.addWorksheet('Field P&L');
      addBrandedHeader(ws, {
        reportTitle: 'Field P&L',
        entityName,
        period,
        generatedAt: new Date(),
        generatedBy,
      }, 8);
      const cols: ColumnDef[] = [
        { header: 'Field', key: 'fieldCode', width: 10 },
        { header: 'Crop', key: 'crop', width: 22 },
        { header: 'Acres', key: 'acres', width: 10, numFmt: QTY_FORMAT, align: 'right' },
        { header: 'Yield kg', key: 'yieldKg', width: 14, numFmt: QTY_FORMAT, align: 'right' },
        { header: 'Revenue', key: 'rev', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
        { header: 'Cost', key: 'cost', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
        { header: 'Margin', key: 'margin', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
        { header: 'Margin / acre', key: 'mpa', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
      ];
      applyTableHeader(ws, cols);
      let totAcres = 0;
      let totYield = 0;
      let totRev = 0;
      let totCost = 0;
      let totMargin = 0;
      for (const p of pnls) {
        addDataRow(ws, cols, {
          fieldCode: fieldCodeById[p.fieldId] ?? p.fieldId.slice(0, 8),
          crop: p.cropName,
          acres: p.acres,
          yieldKg: p.yieldKg,
          rev: p.revenuePkr,
          cost: p.totalCostPkr,
          margin: p.grossMarginPkr,
          mpa: p.marginPerAcrePkr,
        });
        totAcres += p.acres;
        totYield += p.yieldKg;
        totRev += p.revenuePkr;
        totCost += p.totalCostPkr;
        totMargin += p.grossMarginPkr;
      }
      addTotalsRow(
        ws,
        cols,
        {
          acres: totAcres,
          yieldKg: totYield,
          rev: totRev,
          cost: totCost,
          margin: totMargin,
          mpa: totAcres > 0 ? totMargin / totAcres : 0,
        },
        'fieldCode',
      );
      const buf = await workbookToBuffer(wb);
      return xlsxResponse(buf, buildXlsxFilename(slug, period));
    }

    return pdfResponse(
      FieldPnlPdf({
        pnls,
        costPools,
        fieldCodeById,
        entityName,
        generatedBy,
        title: 'Field P&L',
        period,
      }),
      buildPdfFilename(slug, period),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
