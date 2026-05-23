import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger, traceIdFromRequest } from '@zameen/shared/logger';
import type { CostPool } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';
import { loadFieldLedger } from '@/modules/finance/field-ledger-actions';

export async function GET(req: Request) {
  const traceId = traceIdFromRequest(req);
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      logger.warn({ traceId, route: 'field-ledger/xlsx' }, 'unauthorized');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = new URL(req.url);
    const entityId = url.searchParams.get('entityId') ?? ctx.entityId;
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const fromDate = url.searchParams.get('from') ?? monthAgo;
    const toDate = url.searchParams.get('to') ?? today;

    const data = await loadFieldLedger({ entityId, fromDate, toDate });

    const wb = new ExcelJS.Workbook();

    // Sheet 1: flat ledger (date, field, pool, amount, notes-friendly)
    const flat = wb.addWorksheet('Ledger (flat)');
    flat.addRow(['Date', 'Field', 'Acres', 'Cost pool', 'Amount PKR']);
    flat.getRow(1).font = { bold: true };
    for (const r of data.rows) {
      for (const f of data.fields) {
        const cell = r.perField[f.id];
        if (!cell) continue;
        for (const [pool, amt] of Object.entries(cell.byPool)) {
          if (!amt) continue;
          flat.addRow([r.date, f.code, f.acres, pool, Number(amt)]);
        }
      }
    }

    // Sheet 2: pivot matching the UI grid
    const pivot = wb.addWorksheet('Pivot (per-day)');
    const header: Array<string | number> = ['Date'];
    for (const f of data.fields) header.push(`${f.code} (${f.acres.toFixed(2)} ac)`);
    header.push('Day total');
    pivot.addRow(header);
    pivot.getRow(1).font = { bold: true };

    for (const r of data.rows) {
      const row: Array<string | number> = [r.date];
      for (const f of data.fields) {
        const cell = r.perField[f.id];
        row.push(cell ? cell.totalPkr : 0);
      }
      row.push(r.totalPkr);
      pivot.addRow(row);
    }

    const totalRow: Array<string | number> = ['Field total'];
    for (const f of data.fields) totalRow.push(data.fieldTotals[f.id]?.totalPkr ?? 0);
    totalRow.push(data.grandTotalPkr);
    const tr = pivot.addRow(totalRow);
    tr.font = { bold: true };

    const perAcreRow: Array<string | number> = ['Per acre'];
    for (const f of data.fields) perAcreRow.push(data.fieldTotals[f.id]?.perAcrePkr ?? 0);
    perAcreRow.push('');
    pivot.addRow(perAcreRow);

    pivot.addRow([]);
    pivot.addRow(['By cost pool']);
    const pools = Object.keys(data.poolTotals) as CostPool[];
    for (const pool of pools) {
      pivot.addRow([pool, data.poolTotals[pool] ?? 0]);
    }

    for (const ws of [flat, pivot]) {
      for (let i = 2; i <= ws.rowCount; i += 1) {
        for (let c = 1; c <= ws.columnCount; c += 1) {
          const cell = ws.getCell(i, c);
          if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        }
      }
      ws.columns.forEach((col) => {
        col.width = 18;
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    logger.info(
      { traceId, route: 'field-ledger/xlsx', entityId, fromDate, toDate, rows: data.rows.length },
      'rendered',
    );
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="field-ledger-${fromDate}-to-${toDate}.xlsx"`,
      },
    });
  } catch (err) {
    logger.error({ traceId, route: 'field-ledger/xlsx', err: String(err) }, 'render-failed');
    return new NextResponse('Export failed', { status: 500 });
  }
}
