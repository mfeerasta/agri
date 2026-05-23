import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger, traceIdFromRequest } from '@zameen/shared/logger';
import { getSessionContext } from '@/lib/session';
import { loadLabourCostLog } from '@/modules/labor/labour-cost-log-actions';

export async function GET(req: Request) {
  const traceId = traceIdFromRequest(req);
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      logger.warn({ traceId, route: 'labour-cost-log/xlsx' }, 'unauthorized');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = new URL(req.url);
    const entityId = url.searchParams.get('entityId') ?? ctx.entityId;
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const fromDate = url.searchParams.get('from') ?? monthAgo;
    const toDate = url.searchParams.get('to') ?? today;

    const data = await loadLabourCostLog({ entityId, fromDate, toDate });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Labour Cost Log');

    const headerRow: Array<string | number> = ['Date / تاریخ'];
    for (const f of data.fields) {
      headerRow.push(`${f.code} (${f.acres.toFixed(2)} ac)`);
    }
    headerRow.push('Day Total / دن کا کل');
    ws.addRow(headerRow);
    ws.getRow(1).font = { bold: true };

    for (const r of data.rows) {
      const row: Array<string | number> = [r.date];
      for (const f of data.fields) {
        const c = r.perField[f.id];
        row.push(c ? c.totalPkr : 0);
      }
      row.push(r.totalPkr);
      ws.addRow(row);
    }

    const totalRow: Array<string | number> = ['Field Total / کھیت کا کل'];
    for (const f of data.fields) {
      totalRow.push(data.fieldTotals[f.id]?.totalPkr ?? 0);
    }
    totalRow.push(data.grandTotalPkr);
    const tr = ws.addRow(totalRow);
    tr.font = { bold: true };

    const perAcreRow: Array<string | number> = ['PKR / acre'];
    for (const f of data.fields) {
      perAcreRow.push(data.fieldTotals[f.id]?.perAcrePkr ?? 0);
    }
    perAcreRow.push('');
    ws.addRow(perAcreRow);

    const hoursRow: Array<string | number> = ['Total hours'];
    for (const f of data.fields) {
      hoursRow.push(data.fieldTotals[f.id]?.totalHours ?? 0);
    }
    hoursRow.push(data.grandTotalHours);
    ws.addRow(hoursRow);

    ws.addRow([]);
    ws.addRow(['Labour productivity / مزدوری کارکردگی (PKR per acre per day)']);
    const prodHeader: Array<string | number> = ['Field', 'Mean PKR/ac', 'Std dev', 'Days'];
    const prh = ws.addRow(prodHeader);
    prh.font = { bold: true };
    for (const s of data.productivity) {
      ws.addRow([s.fieldCode, s.meanPkrPerAcre, s.stdDevPkrPerAcre, s.points.length]);
    }

    for (let i = 2; i <= ws.rowCount; i += 1) {
      for (let c = 2; c <= data.fields.length + 2; c += 1) {
        const cell = ws.getCell(i, c);
        if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
      }
    }

    ws.columns.forEach((col) => {
      col.width = 20;
    });

    const buf = await wb.xlsx.writeBuffer();
    logger.info(
      { traceId, route: 'labour-cost-log/xlsx', entityId, fromDate, toDate, rows: data.rows.length },
      'rendered',
    );
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="labour-cost-log-${fromDate}-to-${toDate}.xlsx"`,
      },
    });
  } catch (err) {
    logger.error({ traceId, route: 'labour-cost-log/xlsx', err: String(err) }, 'render-failed');
    return new NextResponse('Export failed', { status: 500 });
  }
}
