import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger, traceIdFromRequest } from '@zameen/shared/logger';
import { getSessionContext } from '@/lib/session';
import { loadPayrollMatrix } from '@/modules/labor/payroll-matrix-actions';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export async function GET(req: Request) {
  const traceId = traceIdFromRequest(req);
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      logger.warn({ traceId, route: 'payroll-matrix/xlsx' }, 'unauthorized');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = new URL(req.url);
    const entityId = url.searchParams.get('entityId') ?? ctx.entityId;
    const year = Number(url.searchParams.get('year') ?? new Date().getUTCFullYear());

    const data = await loadPayrollMatrix({ entityId, year });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Payroll ${year}`);

    const headerRow: Array<string | number> = ['Worker / مزدور'];
    for (const m of data.months) headerRow.push(MONTH_LABELS[m - 1] ?? `M${m}`);
    headerRow.push('YTD');
    ws.addRow(headerRow);
    ws.getRow(1).font = { bold: true };

    for (const w of data.workers) {
      const row: Array<string | number> = [`${w.code} ${w.fullName}`];
      for (const m of data.months) {
        const c = data.cells[`${w.id}|${m}`];
        row.push(c ? c.netPkr : 0);
      }
      row.push(data.yearlyTotals[w.id] ?? 0);
      ws.addRow(row);
    }

    const totalRow: Array<string | number> = ['Monthly total / کل'];
    for (const m of data.months) totalRow.push(data.monthlyTotals[m] ?? 0);
    totalRow.push(data.grandTotal);
    const tr = ws.addRow(totalRow);
    tr.font = { bold: true };

    for (let i = 2; i <= ws.rowCount; i += 1) {
      for (let c = 2; c <= data.months.length + 2; c += 1) {
        const cell = ws.getCell(i, c);
        if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
      }
    }
    ws.columns.forEach((col) => {
      col.width = 18;
    });

    const buf = await wb.xlsx.writeBuffer();
    logger.info(
      { traceId, route: 'payroll-matrix/xlsx', entityId, year, workers: data.workers.length },
      'rendered',
    );
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="payroll-matrix-${year}.xlsx"`,
      },
    });
  } catch (err) {
    logger.error({ traceId, route: 'payroll-matrix/xlsx', err: String(err) }, 'render-failed');
    return new NextResponse('Export failed', { status: 500 });
  }
}
