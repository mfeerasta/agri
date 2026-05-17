import { and, eq, gte, lte, inArray, asc } from 'drizzle-orm';
import {
  db,
  journalEntries,
  journalLines,
  accounts,
  fields as fieldsTable,
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
    if (format !== 'xlsx') return badRequest('only xlsx supported for journal export');
    if (!from || !to) return badRequest('from and to (YYYY-MM-DD) are required');

    const entries = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.entityId, session.entityId),
          gte(journalEntries.postedOn, from),
          lte(journalEntries.postedOn, to),
        ),
      )
      .orderBy(asc(journalEntries.postedOn));

    if (entries.length === 0) {
      const period = `${from}-to-${to}`;
      const wb = newWorkbook({
        reportTitle: 'Journal entries',
        entityName: await getEntityName(session.entityId),
        period,
        generatedAt: new Date(),
        generatedBy: await getUserDisplayName(session.userId),
      });
      const ws = wb.addWorksheet('Journal');
      addBrandedHeader(ws, {
        reportTitle: 'Journal entries',
        entityName: await getEntityName(session.entityId),
        period,
        generatedAt: new Date(),
        generatedBy: await getUserDisplayName(session.userId),
      }, 1);
      ws.addRow(['No journal entries in this period.']);
      const buf = await workbookToBuffer(wb);
      return xlsxResponse(buf, buildXlsxFilename('journal-entries', period));
    }

    const entryIds = entries.map((e) => e.id);
    const lines = await db.select().from(journalLines).where(inArray(journalLines.journalEntryId, entryIds));
    const accountIds = Array.from(new Set(lines.map((l) => l.accountId)));
    const fieldIds = Array.from(new Set(lines.map((l) => l.fieldId).filter((x): x is string => !!x)));

    const [accountRows, fieldRows] = await Promise.all([
      accountIds.length
        ? db.select().from(accounts).where(inArray(accounts.id, accountIds))
        : Promise.resolve([] as Array<typeof accounts.$inferSelect>),
      fieldIds.length
        ? db.select().from(fieldsTable).where(inArray(fieldsTable.id, fieldIds))
        : Promise.resolve([] as Array<typeof fieldsTable.$inferSelect>),
    ]);
    const accountById = new Map(accountRows.map((a) => [a.id, a]));
    const fieldById = new Map(fieldRows.map((f) => [f.id, f]));
    const entryById = new Map(entries.map((e) => [e.id, e]));

    const period = `${from}-to-${to}`;
    const [entityName, generatedBy] = await Promise.all([
      getEntityName(session.entityId),
      getUserDisplayName(session.userId),
    ]);
    const meta = {
      reportTitle: 'Journal entries',
      entityName,
      period,
      generatedAt: new Date(),
      generatedBy,
    };

    const wb = newWorkbook(meta);
    const ws = wb.addWorksheet('Journal lines');
    addBrandedHeader(ws, meta, 11);
    const cols: ColumnDef[] = [
      { header: 'Posted', key: 'date', width: 14, numFmt: DATE_FORMAT },
      { header: 'Journal #', key: 'journalNumber', width: 14 },
      { header: 'Narration', key: 'narration', width: 38 },
      { header: 'Account code', key: 'accountCode', width: 14 },
      { header: 'Account name', key: 'accountName', width: 26 },
      { header: 'Field', key: 'fieldCode', width: 10 },
      { header: 'Cost pool', key: 'costPool', width: 14 },
      { header: 'Debit', key: 'debit', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Credit', key: 'credit', width: 16, numFmt: MONEY_FORMAT, align: 'right' },
      { header: 'Source module', key: 'sourceModule', width: 16 },
      { header: 'Source record id', key: 'sourceRecordId', width: 38 },
    ];
    applyTableHeader(ws, cols);

    for (const line of lines) {
      const e = entryById.get(line.journalEntryId);
      if (!e) continue;
      const acc = accountById.get(line.accountId);
      const fld = line.fieldId ? fieldById.get(line.fieldId) : undefined;
      addDataRow(ws, cols, {
        date: new Date(e.postedOn),
        journalNumber: e.journalNumber,
        narration: line.narration ?? e.narration,
        accountCode: acc?.code ?? '',
        accountName: acc?.name ?? '',
        fieldCode: fld?.code ?? '',
        costPool: line.costPool ?? '',
        debit: Number(line.debitPkr),
        credit: Number(line.creditPkr),
        sourceModule: e.sourceModule ?? '',
        sourceRecordId: e.sourceRecordId ?? '',
      });
    }

    const buf = await workbookToBuffer(wb);
    return xlsxResponse(buf, buildXlsxFilename('journal-entries', period));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
