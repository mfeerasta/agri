import {
  newWorkbook,
  addBrandedHeader,
  applyTableHeader,
  addDataRow,
  workbookToBuffer,
  MONEY_FORMAT,
  QTY_FORMAT,
  type ColumnDef,
  type WorkbookHeader,
} from './excel-template';
import type { YoYReportData } from './yoy-report';

export async function buildYoYXlsx(data: YoYReportData, meta: WorkbookHeader): Promise<Buffer> {
  const wb = newWorkbook(meta);

  const cmp = wb.addWorksheet('Comparison', { properties: { tabColor: { argb: 'FF1F4D2B' } } });
  addBrandedHeader(cmp, meta, 9);
  const cols: ColumnDef[] = [
    { header: 'Crop', key: 'crop', width: 22 },
    { header: `${data.currentSeason} yield/ac kg`, key: 'yieldCurr', width: 18, numFmt: QTY_FORMAT, align: 'right' },
    { header: `${data.previousSeason} yield/ac kg`, key: 'yieldPrev', width: 18, numFmt: QTY_FORMAT, align: 'right' },
    { header: 'Yield Δ %', key: 'yieldDelta', width: 12, numFmt: '0.00"%"', align: 'right' },
    { header: 'Revenue', key: 'revenue', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
    { header: 'Cost', key: 'cost', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
    { header: 'Cost Δ %', key: 'costDelta', width: 12, numFmt: '0.00"%"', align: 'right' },
    { header: 'Margin/ac', key: 'mpa', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
    { header: 'Margin Δ %', key: 'marginDelta', width: 12, numFmt: '0.00"%"', align: 'right' },
  ];
  applyTableHeader(cmp, cols);
  for (const r of data.rows) {
    addDataRow(cmp, cols, {
      crop: r.cropName,
      yieldCurr: r.current.yieldPerAcreKg,
      yieldPrev: r.previous?.yieldPerAcreKg ?? null,
      yieldDelta: r.yieldDeltaPct,
      revenue: r.current.revenuePkr,
      cost: r.current.totalCostPkr,
      costDelta: r.costDeltaPct,
      mpa: r.current.marginPerAcrePkr,
      marginDelta: r.marginDeltaPct,
    });
  }

  if (data.costPoolTrends.length > 0) {
    const pool = wb.addWorksheet('Cost pool trend');
    addBrandedHeader(pool, meta, 6);
    const poolCols: ColumnDef[] = [
      { header: 'Pool', key: 'pool', width: 22 },
      { header: `${data.previousSeason} total`, key: 'prev', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
      { header: `${data.currentSeason} total`, key: 'curr', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Prev /acre', key: 'prevPa', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Curr /acre', key: 'currPa', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'CAGR %', key: 'cagr', width: 12, numFmt: '0.00"%"', align: 'right' },
    ];
    applyTableHeader(pool, poolCols);
    for (const p of data.costPoolTrends) {
      const prev = p.perSeason.find((s) => s.seasonLabel === data.previousSeason);
      const curr = p.perSeason.find((s) => s.seasonLabel === data.currentSeason);
      addDataRow(pool, poolCols, {
        pool: p.costPool.replace(/_/g, ' '),
        prev: prev?.totalPkr ?? 0,
        curr: curr?.totalPkr ?? 0,
        prevPa: prev?.perAcrePkr ?? 0,
        currPa: curr?.perAcrePkr ?? 0,
        cagr: p.cagr,
      });
    }
  }

  return workbookToBuffer(wb);
}
