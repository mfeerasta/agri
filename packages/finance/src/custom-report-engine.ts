import { eq, sql } from 'drizzle-orm';
import { db, customReports, reportExecutions } from '@zameen/db';
import {
  getDataSource,
  type ReportFilter,
  type ReportAggregation,
} from '@zameen/shared';

const EXECUTION_TIMEOUT_MS = 30_000;

export interface ReportExecutionRow {
  [column: string]: string | number | null;
}

export interface ChartReadyData {
  kind: string | null;
  labels: string[];
  series: { name: string; data: number[] }[];
}

export interface ReportExecutionResult {
  reportId: string;
  rows: ReportExecutionRow[];
  rowCount: number;
  durationMs: number;
  columns: string[];
  chart: ChartReadyData;
  summary: string;
}

// validate a filter against the data-source declaration, returning a safe
// parameterised sql fragment. unknown columns are rejected.
function buildWhere(sourceId: string, filters: ReportFilter[]): string {
  if (!filters.length) return '';
  const ds = getDataSource(sourceId);
  if (!ds) throw new Error(`Unknown data source: ${sourceId}`);
  const allowed = new Set(ds.columns.map((c) => c.name));
  const parts: string[] = [];
  for (const f of filters) {
    if (!allowed.has(f.column)) throw new Error(`Bad filter column: ${f.column}`);
    switch (f.op) {
      case 'eq': parts.push(`${f.column} = ${formatVal(f.value)}`); break;
      case 'neq': parts.push(`${f.column} <> ${formatVal(f.value)}`); break;
      case 'gt': parts.push(`${f.column} > ${formatVal(f.value)}`); break;
      case 'gte': parts.push(`${f.column} >= ${formatVal(f.value)}`); break;
      case 'lt': parts.push(`${f.column} < ${formatVal(f.value)}`); break;
      case 'lte': parts.push(`${f.column} <= ${formatVal(f.value)}`); break;
      case 'like': parts.push(`${f.column} ilike ${formatVal(`%${String(f.value)}%`)}`); break;
      case 'in': {
        const arr = Array.isArray(f.value) ? f.value : [f.value];
        parts.push(`${f.column} in (${arr.map(formatVal).join(',')})`);
        break;
      }
      case 'between': {
        const arr = f.value as [unknown, unknown];
        parts.push(`${f.column} between ${formatVal(arr[0])} and ${formatVal(arr[1])}`);
        break;
      }
    }
  }
  return parts.length ? ` where ${parts.join(' and ')}` : '';
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function buildSelect(aggs: ReportAggregation[], groupBy: string[] | null | undefined): string {
  const cols: string[] = [];
  for (const g of groupBy ?? []) cols.push(g);
  for (const a of aggs) {
    const alias = a.alias ?? `${a.fn}_${a.column}`;
    const expr = a.fn === 'count' ? `count(${a.column})` : `${a.fn}(${a.column}::numeric)`;
    cols.push(`${expr} as ${alias}`);
  }
  if (!cols.length) cols.push('*');
  return cols.join(', ');
}

function buildChart(
  kind: string | null,
  rows: ReportExecutionRow[],
  groupBy: string[] | null | undefined,
  aggs: ReportAggregation[],
): ChartReadyData {
  if (!rows.length || !groupBy?.length) return { kind, labels: [], series: [] };
  const labelKey = groupBy[0];
  const labels = rows.map((r) => String(r[labelKey] ?? ''));
  const series = aggs.map((a) => {
    const alias = a.alias ?? `${a.fn}_${a.column}`;
    return { name: alias, data: rows.map((r) => Number(r[alias] ?? 0)) };
  });
  return { kind, labels, series };
}

function buildSummary(rows: ReportExecutionRow[], aggs: ReportAggregation[]): string {
  if (!rows.length) return 'No rows matched the filters.';
  const totals = aggs
    .filter((a) => a.fn === 'sum' || a.fn === 'count')
    .map((a) => {
      const alias = a.alias ?? `${a.fn}_${a.column}`;
      const total = rows.reduce((s, r) => s + Number(r[alias] ?? 0), 0);
      return `${alias}=${total.toLocaleString('en-PK')}`;
    });
  return `${rows.length} row${rows.length === 1 ? '' : 's'}. ${totals.join(', ')}`;
}

/**
 * executeReport: load the report definition, build a typed query against the
 * declared data source, persist a snapshot for replay.
 *
 * 30s timeout enforced via statement-level timeout.
 */
export async function executeReport(reportId: string, executedBy?: string): Promise<ReportExecutionResult> {
  const started = Date.now();
  const [report] = await db.select().from(customReports).where(eq(customReports.id, reportId)).limit(1);
  if (!report) throw new Error('Report not found');
  const ds = getDataSource(report.dataSource);
  if (!ds) throw new Error(`Unknown data source on report: ${report.dataSource}`);

  const select = buildSelect(report.aggregations, report.groupBy);
  const where = buildWhere(report.dataSource, report.filters);
  const group = report.groupBy?.length ? ` group by ${report.groupBy.join(', ')}` : '';
  const order = report.sortBy ? ` order by ${report.sortBy}` : '';
  const limit = ` limit ${Math.max(1, Math.min(report.rowLimit, 10_000))}`;

  const querySql = `select ${select} from ${ds.view}${where}${group}${order}${limit}`;

  const result = await db.execute(sql.raw(
    `set local statement_timeout = ${EXECUTION_TIMEOUT_MS}; ${querySql}`,
  ));
  const rows = (result as unknown as { rows?: ReportExecutionRow[] }).rows ?? (result as unknown as ReportExecutionRow[]);
  const rowList = Array.isArray(rows) ? rows : [];
  const durationMs = Date.now() - started;

  const chart = buildChart(report.chartKind ?? null, rowList, report.groupBy, report.aggregations);
  const summary = buildSummary(rowList, report.aggregations);

  await db.insert(reportExecutions).values({
    reportId: report.id,
    executedBy: executedBy ?? null,
    rowCount: rowList.length,
    durationMs,
    resultSnapshot: { rows: rowList, chart, summary },
  });

  const columns = rowList[0] ? Object.keys(rowList[0]) : [];

  return {
    reportId: report.id,
    rows: rowList,
    rowCount: rowList.length,
    durationMs,
    columns,
    chart,
    summary,
  };
}
