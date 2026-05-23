import { loadStudy } from '@/modules/feasibility/actions';
import { COST_KEYS } from '@/modules/feasibility/calc';
import { getSessionContext } from '@/lib/session';
import {
  newWorkbook,
  addBrandedHeader,
  applyTableHeader,
  addDataRow,
  addTotalsRow,
  workbookToBuffer,
  buildXlsxFilename,
  MONEY_FORMAT,
  QTY_FORMAT,
  type ColumnDef,
} from '@/lib/reports/excel-template';
import { xlsxResponse, unauthorized, badRequest, serverError } from '@/lib/reports/response';
import { getEntityName, getUserDisplayName } from '@/lib/reports/entity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx {
  params: Promise<{ studyId: string }>;
}

export async function GET(_req: Request, { params }: RouteCtx): Promise<Response> {
  try {
    const session = await getSessionContext();
    if (!session) return unauthorized();
    const { studyId } = await params;
    const data = await loadStudy(studyId);
    if (!data) return badRequest('study not found');

    const [entityName, generatedBy] = await Promise.all([
      getEntityName(session.entityId),
      getUserDisplayName(session.userId),
    ]);
    const period = data.study.season ?? 'planner';

    const wb = newWorkbook({
      reportTitle: `Feasibility planner - ${data.study.name}`,
      entityName,
      period,
      generatedAt: new Date(),
      generatedBy,
    });
    const ws = wb.addWorksheet('Scenarios');
    const baseCols: ColumnDef[] = [
      { header: 'Scenario', key: 'name', width: 24 },
      { header: 'Crop', key: 'crop', width: 12 },
      { header: 'Acres', key: 'acres', width: 10, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'Yield kg/acre', key: 'ypa', width: 14, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'Price PKR/kg', key: 'price', width: 14, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Revenue', key: 'revenue', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
    ];
    const costCols: ColumnDef[] = COST_KEYS.map((k) => ({
      header: `Cost ${k}/acre`,
      key: `cost_${k}`,
      width: 14,
      numFmt: MONEY_FORMAT,
      align: 'right' as const,
    }));
    const tailCols: ColumnDef[] = [
      { header: 'Total cost', key: 'totalCost', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Net', key: 'net', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Net / acre', key: 'npa', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'IRR %', key: 'irr', width: 10, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'Payback (m)', key: 'payback', width: 12, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    const cols = [...baseCols, ...costCols, ...tailCols];

    addBrandedHeader(
      ws,
      {
        reportTitle: `Feasibility planner - ${data.study.name}`,
        entityName,
        period,
        generatedAt: new Date(),
        generatedBy,
      },
      cols.length,
    );
    applyTableHeader(ws, cols);

    let totRevenue = 0;
    let totCost = 0;
    let totNet = 0;
    let totAcres = 0;
    for (const s of data.scenarios) {
      const row: Record<string, string | number | null> = {
        name: s.name,
        crop: s.cropCode,
        acres: Number(s.totalAcres),
        ypa: Number(s.yieldPerAcreKg),
        price: Number(s.pricePerKgPkr),
        revenue: Number(s.revenuePkr),
        totalCost: Number(s.totalCostPkr),
        net: Number(s.netPkr),
        npa: Number(s.netPerAcrePkr),
        irr: s.irrPct != null ? Number(s.irrPct) : null,
        payback: s.paybackMonths != null ? Number(s.paybackMonths) : null,
        notes: s.notes ?? '',
      };
      const cb = (s.costBreakdown ?? {}) as Record<string, number>;
      for (const k of COST_KEYS) row[`cost_${k}`] = Number(cb[k] ?? 0);
      addDataRow(ws, cols, row);
      totAcres += Number(s.totalAcres);
      totRevenue += Number(s.revenuePkr);
      totCost += Number(s.totalCostPkr);
      totNet += Number(s.netPkr);
    }
    addTotalsRow(
      ws,
      cols,
      {
        acres: totAcres,
        revenue: totRevenue,
        totalCost: totCost,
        net: totNet,
        npa: totAcres > 0 ? totNet / totAcres : 0,
      },
      'name',
    );

    const buf = await workbookToBuffer(wb);
    const slug = `feasibility-${data.study.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return xlsxResponse(buf, buildXlsxFilename(slug, period));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'unknown error');
  }
}
