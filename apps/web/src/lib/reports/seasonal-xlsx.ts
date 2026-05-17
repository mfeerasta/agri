import {
  newWorkbook,
  addBrandedHeader,
  applyTableHeader,
  addDataRow,
  addTotalsRow,
  workbookToBuffer,
  MONEY_FORMAT,
  QTY_FORMAT,
  type ColumnDef,
  type WorkbookHeader,
} from './excel-template';
import type { SeasonalReportData } from './seasonal-report';

export async function buildSeasonalXlsx(
  data: SeasonalReportData,
  meta: WorkbookHeader,
): Promise<Buffer> {
  const wb = newWorkbook(meta);

  // Sheet 1: P&L
  const pnl = wb.addWorksheet('P&L', { properties: { tabColor: { argb: 'FF1F4D2B' } } });
  addBrandedHeader(pnl, meta, 8);
  const pnlCols: ColumnDef[] = [
    { header: 'Field', key: 'fieldCode', width: 10 },
    { header: 'Crop', key: 'cropName', width: 22 },
    { header: 'Acres', key: 'acres', width: 10, numFmt: QTY_FORMAT, align: 'right' },
    { header: 'Yield kg', key: 'yieldKg', width: 14, numFmt: QTY_FORMAT, align: 'right' },
    { header: 'Revenue', key: 'revenue', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
    { header: 'Cost', key: 'cost', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
    { header: 'Margin', key: 'margin', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
    { header: 'Margin / acre', key: 'marginPerAcre', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
  ];
  applyTableHeader(pnl, pnlCols);
  for (const r of data.rows) {
    addDataRow(pnl, pnlCols, {
      fieldCode: r.fieldCode,
      cropName: r.cropName,
      acres: r.acres,
      yieldKg: r.yieldKg,
      revenue: r.revenuePkr,
      cost: r.totalCostPkr,
      margin: r.grossMarginPkr,
      marginPerAcre: r.marginPerAcrePkr,
    });
  }
  addTotalsRow(
    pnl,
    pnlCols,
    {
      acres: data.totals.acres,
      yieldKg: data.totals.yieldKg,
      revenue: data.totals.revenuePkr,
      cost: data.totals.totalCostPkr,
      margin: data.totals.grossMarginPkr,
      marginPerAcre: data.totals.weightedMarginPerAcrePkr,
    },
    'fieldCode',
  );

  // Sheet 2: Cost pools
  if (data.costPools.length > 0) {
    const pools = wb.addWorksheet('Cost pools');
    addBrandedHeader(pools, meta, 1 + data.costPools.length);
    const poolCols: ColumnDef[] = [
      { header: 'Field', key: 'fieldCode', width: 12 },
      ...data.costPools.map((p) => ({
        header: p.replace(/_/g, ' '),
        key: `pool_${p}`,
        width: 16,
        numFmt: MONEY_FORMAT,
        align: 'right' as const,
      })),
    ];
    applyTableHeader(pools, poolCols);
    for (const r of data.rows) {
      const row: Record<string, string | number> = { fieldCode: r.fieldCode };
      for (const p of data.costPools) row[`pool_${p}`] = r.costByPool[p] ?? 0;
      addDataRow(pools, poolCols, row);
    }
  }

  // Sheet 3: Yield variance
  const vary = wb.addWorksheet('Yield variance');
  addBrandedHeader(vary, meta, 5);
  const varCols: ColumnDef[] = [
    { header: 'Field', key: 'fieldCode', width: 10 },
    { header: 'Crop', key: 'cropName', width: 22 },
    { header: 'Actual kg / acre', key: 'actual', width: 18, numFmt: QTY_FORMAT, align: 'right' },
    { header: 'Benchmark kg / acre', key: 'benchmark', width: 20, numFmt: QTY_FORMAT, align: 'right' },
    { header: 'Delta %', key: 'delta', width: 12, numFmt: '0.00"%"', align: 'right' },
  ];
  applyTableHeader(vary, varCols);
  for (const r of data.rows) {
    addDataRow(vary, varCols, {
      fieldCode: r.fieldCode,
      cropName: r.cropName,
      actual: r.yieldPerAcreKg,
      benchmark: r.benchmarkPerAcre ?? null,
      delta: r.variancePct ?? null,
    });
  }

  // Sheet 4: Decisions
  const dec = wb.addWorksheet('Decisions');
  addBrandedHeader(dec, meta, 5);
  const decCols: ColumnDef[] = [
    { header: 'When', key: 'occurredAt', width: 22 },
    { header: 'Approval type', key: 'approvalType', width: 18 },
    { header: 'Title', key: 'title', width: 36 },
    { header: 'Action', key: 'action', width: 14 },
    { header: 'Role', key: 'actorRole', width: 14 },
    { header: 'Comment', key: 'comment', width: 40 },
  ];
  applyTableHeader(dec, decCols);
  for (const d of data.decisions) {
    addDataRow(dec, decCols, {
      occurredAt: new Date(d.occurredAt),
      approvalType: d.approvalType,
      title: d.title,
      action: d.action,
      actorRole: d.actorRole,
      comment: d.comment ?? '',
    });
  }

  return workbookToBuffer(wb);
}
