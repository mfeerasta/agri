import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { db, esgMetricsSnapshots, carbonAssessments } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return new NextResponse('Unauthorized', { status: 401 });
  const url = new URL(req.url);
  const snapshotId = url.searchParams.get('snapshotId');
  const format = url.searchParams.get('format') ?? 'xlsx';
  if (!snapshotId) return new NextResponse('snapshotId required', { status: 400 });

  const [snap] = await db
    .select()
    .from(esgMetricsSnapshots)
    .where(and(eq(esgMetricsSnapshots.id, snapshotId), eq(esgMetricsSnapshots.entityId, ctx.entityId)));
  if (!snap) return new NextResponse('Not found', { status: 404 });

  // Pull most recent assessment in snapshot period.
  const assessments = await db
    .select()
    .from(carbonAssessments)
    .where(eq(carbonAssessments.entityId, ctx.entityId));
  const inPeriod = assessments.find(
    (a) => a.assessmentDate >= snap.periodStart && a.assessmentDate <= snap.periodEnd,
  );

  if (format === 'pdf') {
    const html = renderHtml(snap, inPeriod);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="esg-${snap.snapshotDate}.html"`,
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zameen';
  const meta = wb.addWorksheet('Summary');
  meta.addRows([
    ['ESG snapshot'],
    ['Snapshot date', snap.snapshotDate],
    ['Period', `${snap.periodStart} to ${snap.periodEnd}`],
    ['Framework', snap.framework ?? ''],
    [],
    ['Environmental'],
    ...Object.entries(snap.environmental as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
    [],
    ['Social'],
    ...Object.entries(snap.social as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
    [],
    ['Governance'],
    ...Object.entries(snap.governance as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
  ]);
  meta.getColumn(1).width = 38;
  meta.getColumn(2).width = 32;

  if (inPeriod) {
    const cs = wb.addWorksheet('Carbon');
    const scope = inPeriod.scopeCo2eTons as Record<string, Record<string, number>>;
    cs.addRows([
      ['Assessment date', inPeriod.assessmentDate],
      ['Methodology', inPeriod.methodology ?? ''],
      ['Total emissions (tCO2e)', Number(inPeriod.totalEmissionsCo2eTons)],
      ['Total sequestration (tCO2e)', Number(inPeriod.totalSequestrationCo2eTons)],
      ['Net (tCO2e)', Number(inPeriod.netCo2eTons)],
      [],
      ['Scope breakdown'],
      ...Object.entries(scope).flatMap(([group, vals]) => [
        [group, ''],
        ...Object.entries(vals).map(([k, v]) => [`  ${k}`, Number(v)]),
      ]),
    ]);
    cs.getColumn(1).width = 42;
    cs.getColumn(2).width = 18;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="esg-${snap.snapshotDate}.xlsx"`,
    },
  });
}

function renderHtml(
  snap: typeof esgMetricsSnapshots.$inferSelect,
  ca: typeof carbonAssessments.$inferSelect | undefined,
): string {
  const env = snap.environmental as Record<string, unknown>;
  const soc = snap.social as Record<string, unknown>;
  const gov = snap.governance as Record<string, unknown>;
  const row = (k: string, v: unknown) => `<tr><td>${escape(k)}</td><td>${escape(String(v ?? ''))}</td></tr>`;
  const section = (title: string, obj: Record<string, unknown>) => `
    <h2>${title}</h2>
    <table>${Object.entries(obj).map(([k, v]) => row(k, v)).join('')}</table>`;
  const carbonHtml = ca
    ? `<h2>Carbon footprint (${escape(ca.assessmentDate)})</h2>
       <table>
         <tr><td>Total emissions (tCO2e)</td><td>${Number(ca.totalEmissionsCo2eTons).toFixed(3)}</td></tr>
         <tr><td>Total sequestration (tCO2e)</td><td>${Number(ca.totalSequestrationCo2eTons).toFixed(3)}</td></tr>
         <tr><td>Net (tCO2e)</td><td>${Number(ca.netCo2eTons).toFixed(3)}</td></tr>
         <tr><td>Methodology</td><td>${escape(ca.methodology ?? '')}</td></tr>
       </table>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>ESG ${escape(snap.snapshotDate)}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:32px;color:#111}
    h1{margin:0 0 4px} h2{margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
    table{border-collapse:collapse;width:100%;font-size:13px}
    td{border:1px solid #e5e7eb;padding:6px 10px}
    td:first-child{width:40%;color:#555}
    .meta{color:#666;font-size:13px}
    @media print { body { margin: 18mm; } }
  </style></head><body>
  <h1>ESG snapshot</h1>
  <div class="meta">${escape(snap.snapshotDate)} - period ${escape(snap.periodStart)} to ${escape(snap.periodEnd)} - framework ${escape(snap.framework ?? '')}</div>
  ${section('Environmental', env)}
  ${section('Social', soc)}
  ${section('Governance', gov)}
  ${carbonHtml}
  <script>window.onload=()=>window.print&&setTimeout(()=>window.print(),300)</script>
  </body></html>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}
