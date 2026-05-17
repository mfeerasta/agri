import { and, eq, gte, lte, inArray, asc } from 'drizzle-orm';
import {
  db,
  costAllocations,
  fields as fieldsTable,
  cropPlans,
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

    const rows = await db
      .select()
      .from(costAllocations)
      .where(
        and(
          eq(costAllocations.entityId, session.entityId),
          gte(costAllocations.allocatedOn, from),
          lte(costAllocations.allocatedOn, to),
        ),
      )
      .orderBy(asc(costAllocations.allocatedOn));

    const fieldIds = Array.from(new Set(rows.map((r) => r.fieldId).filter((x): x is string => !!x)));
    const planIds = Array.from(new Set(rows.map((r) => r.cropPlanId).filter((x): x is string => !!x)));
    const [fieldRows, planRows] = await Promise.all([
      fieldIds.length ? db.select().from(fieldsTable).where(inArray(fieldsTable.id, fieldIds)) : Promise.resolve([] as Array<typeof fieldsTable.$inferSelect>),
      planIds.length ? db.select().from(cropPlans).where(inArray(cropPlans.id, planIds)) : Promise.resolve([] as Array<typeof cropPlans.$inferSelect>),
    ]);
    const fieldById = new Map(fieldRows.map((f) => [f.id, f]));
    const planById = new Map(planRows.map((p) => [p.id, p]));

    const period = `${from}-to-${to}`;
    const [entityName, generatedBy] = await Promise.all([
      getEntityName(session.entityId),
      getUserDisplayName(session.userId),
    ]);
    const meta = {
      reportTitle: 'Cost allocations',
      entityName,
      period,
      generatedAt: new Date(),
      generatedBy,
    };

    const wb = newWorkbook(meta);
    const ws = wb.addWorksheet('Cost allocations');
    addBrandedHeader(ws, meta, 8);
    const cols: ColumnDef[] = [
      { header: 'Date', key: 'date', width: 12, numFmt: DATE_FORMAT },
      { header: 'Source module', key: 'sourceModule', width: 18 },
      { header: 'Source record id', key: 'sourceRecordId', width: 38 },
      { header: 'Cost pool', key: 'costPool', width: 16 },
      { header: 'Field', key: 'fieldCode', width: 10 },
      { header: 'Plan season', key: 'planSeason', width: 14 },
      { header: 'Amount', key: 'amount', width: 18, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Notes', key: 'notes', width: 32 },
    ];
    applyTableHeader(ws, cols);

    for (const r of rows) {
      const fld = r.fieldId ? fieldById.get(r.fieldId) : undefined;
      const plan = r.cropPlanId ? planById.get(r.cropPlanId) : undefined;
      addDataRow(ws, cols, {
        date: new Date(r.allocatedOn),
        sourceModule: r.sourceModule,
        sourceRecordId: r.sourceRecordId,
        costPool: r.costPool,
        fieldCode: fld?.code ?? '',
        planSeason: plan?.seasonLabel ?? '',
        amount: Number(r.amountPkr),
        notes: r.notes ?? '',
      });
    }

    const buf = await workbookToBuffer(wb);
    return xlsxResponse(buf, buildXlsxFilename('cost-allocations', period));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
