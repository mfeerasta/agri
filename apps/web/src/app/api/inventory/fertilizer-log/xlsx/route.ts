import { NextResponse } from 'next/server';
import { logger, traceIdFromRequest } from '@zameen/shared/logger';
import { getSessionContext } from '@/lib/session';
import { loadInputUsageLog } from '@/modules/inventory/input-usage-log-actions';
import { renderInputUsageXlsx } from '@/modules/inventory/input-usage-xlsx';

export async function GET(req: Request) {
  const traceId = traceIdFromRequest(req);
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      logger.warn({ traceId, route: 'fertilizer-log/xlsx' }, 'unauthorized');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = new URL(req.url);
    const entityId = url.searchParams.get('entityId') ?? ctx.entityId;
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const fromDate = url.searchParams.get('from') ?? monthAgo;
    const toDate = url.searchParams.get('to') ?? today;

    const data = await loadInputUsageLog({ entityId, fromDate, toDate, inputType: 'fertilizer' });
    const buf = await renderInputUsageXlsx(data, {
      sheetName: 'Fertilizer Log',
      sectionLabel: 'By fertilizer type / کھاد کی قسم سے',
    });

    logger.info(
      { traceId, route: 'fertilizer-log/xlsx', entityId, fromDate, toDate, rows: data.rows.length },
      'rendered',
    );
    return new NextResponse(buf, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="fertilizer-log-${fromDate}-to-${toDate}.xlsx"`,
      },
    });
  } catch (err) {
    logger.error({ traceId, route: 'fertilizer-log/xlsx', err: String(err) }, 'render-failed');
    return new NextResponse('Export failed', { status: 500 });
  }
}
