import { and, eq, gte, lte, inArray, asc } from 'drizzle-orm';
import {
  db,
  dieselDailyLogs,
  assets,
  fields as fieldsTable,
  users,
} from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import {
  newWorkbook,
  addBrandedHeader,
  applyTableHeader,
  addDataRow,
  workbookToBuffer,
  buildXlsxFilename,
  MONEY_FORMAT,
  QTY_FORMAT,
  DATE_FORMAT,
  type ColumnDef,
} from '@/lib/reports/excel-template';
import { xlsxResponse, badRequest, unauthorized, serverError } from '@/lib/reports/response';
import { getEntityName, getUserDisplayName } from '@/lib/reports/entity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getSessionContext();
    if (!session) return unauthorized();
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const format = (url.searchParams.get('format') ?? 'xlsx').toLowerCase();
    if (format !== 'xlsx') return badRequest('only xlsx supported');
    if (!from || !to) return badRequest('from and to (YYYY-MM-DD) are required');

    const logs = await db
      .select()
      .from(dieselDailyLogs)
      .where(
        and(
          eq(dieselDailyLogs.entityId, session.entityId),
          gte(dieselDailyLogs.logDate, from),
          lte(dieselDailyLogs.logDate, to),
        ),
      )
      .orderBy(asc(dieselDailyLogs.logDate));

    const assetIds = Array.from(new Set(logs.map((l) => l.assetId)));
    const fieldIds = Array.from(new Set(logs.map((l) => l.taskFieldId).filter((x): x is string => !!x)));
    const operatorIds = Array.from(new Set(logs.map((l) => l.operatorId).filter((x): x is string => !!x)));

    const [assetRows, fieldRows, operatorRows] = await Promise.all([
      assetIds.length ? db.select().from(assets).where(inArray(assets.id, assetIds)) : Promise.resolve([] as Array<typeof assets.$inferSelect>),
      fieldIds.length ? db.select().from(fieldsTable).where(inArray(fieldsTable.id, fieldIds)) : Promise.resolve([] as Array<typeof fieldsTable.$inferSelect>),
      operatorIds.length ? db.select().from(users).where(inArray(users.id, operatorIds)) : Promise.resolve([] as Array<typeof users.$inferSelect>),
    ]);
    const assetById = new Map(assetRows.map((a) => [a.id, a]));
    const fieldById = new Map(fieldRows.map((f) => [f.id, f]));
    const opById = new Map(operatorRows.map((o) => [o.id, o]));

    const period = `${from}-to-${to}`;
    const [entityName, generatedBy] = await Promise.all([
      getEntityName(session.entityId),
      getUserDisplayName(session.userId),
    ]);
    const meta = {
      reportTitle: 'Diesel daily logs',
      entityName,
      period,
      generatedAt: new Date(),
      generatedBy,
    };

    const wb = newWorkbook(meta);
    const ws = wb.addWorksheet('Diesel logs');
    addBrandedHeader(ws, meta, 11);
    const cols: ColumnDef[] = [
      { header: 'Date', key: 'date', width: 12, numFmt: DATE_FORMAT },
      { header: 'Asset', key: 'asset', width: 22 },
      { header: 'Field', key: 'field', width: 10 },
      { header: 'Operator', key: 'operator', width: 22 },
      { header: 'HM start', key: 'hmStart', width: 12, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'HM end', key: 'hmEnd', width: 12, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'Hours', key: 'hours', width: 10, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'Litres', key: 'litres', width: 12, numFmt: QTY_FORMAT, align: 'right' },
      { header: 'Rate / L', key: 'rate', width: 14, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Total cost', key: 'total', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Anomaly', key: 'anomaly', width: 16 },
    ];
    applyTableHeader(ws, cols);
    for (const l of logs) {
      const asset = assetById.get(l.assetId);
      const fld = l.taskFieldId ? fieldById.get(l.taskFieldId) : undefined;
      const op = l.operatorId ? opById.get(l.operatorId) : undefined;
      addDataRow(ws, cols, {
        date: new Date(l.logDate),
        asset: asset?.name ?? asset?.id ?? '',
        field: fld?.code ?? '',
        operator: op?.fullName ?? l.operatorName ?? '',
        hmStart: Number(l.hourMeterStart),
        hmEnd: Number(l.hourMeterEnd),
        hours: Number(l.hoursRun),
        litres: Number(l.dieselFilledLiters),
        rate: Number(l.rateLiterPkr),
        total: Number(l.totalCostPkr),
        anomaly: l.anomalyFlag ?? '',
      });
    }

    const buf = await workbookToBuffer(wb);
    return xlsxResponse(buf, buildXlsxFilename('diesel-daily-log', period));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
