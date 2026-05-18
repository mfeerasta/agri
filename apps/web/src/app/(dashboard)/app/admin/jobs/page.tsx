import Link from 'next/link';
import { db, jobRuns } from '@zameen/db';
import { and, desc, gte, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, StatusLabel } from '@zameen/ui';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ status?: string; kind?: string; name?: string }>;
}

export default async function AdminJobsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const conditions = [gte(jobRuns.startedAt, since)];
  if (sp.status) conditions.push(eq(jobRuns.status, sp.status));
  if (sp.kind) conditions.push(eq(jobRuns.jobKind, sp.kind));
  if (sp.name) conditions.push(eq(jobRuns.jobName, sp.name));

  const rows = await db
    .select()
    .from(jobRuns)
    .where(and(...conditions))
    .orderBy(desc(jobRuns.startedAt))
    .limit(500);

  const total = rows.length;
  const failed = rows.filter((r) => r.status === 'failed' || r.status === 'timed_out').length;
  const durations = rows
    .filter((r) => typeof r.durationMs === 'number')
    .map((r) => r.durationMs as number);
  const avgMs = durations.length === 0
    ? 0
    : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  const uniqueJobs = Array.from(new Set(rows.map((r) => r.jobName))).sort();

  return (
    <div>
      <Masthead section="JOB RUNS · last 24h" />
      <SectionDivider />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><CardHeader><CardTitle>Total runs</CardTitle></CardHeader><CardContent><div className="tabular text-2xl">{total}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Failed</CardTitle></CardHeader><CardContent><div className="tabular text-2xl text-rose-700">{failed}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Avg duration</CardTitle></CardHeader><CardContent><div className="tabular text-2xl">{avgMs} ms</div></CardContent></Card>
      </div>

      <form className="flex flex-wrap gap-2 mb-3 text-xs">
        <select name="status" defaultValue={sp.status ?? ''} className="rounded-md border px-2 py-1">
          <option value="">all status</option>
          <option value="succeeded">succeeded</option>
          <option value="running">running</option>
          <option value="failed">failed</option>
          <option value="timed_out">timed_out</option>
        </select>
        <select name="kind" defaultValue={sp.kind ?? ''} className="rounded-md border px-2 py-1">
          <option value="">all kinds</option>
          <option value="pg_cron">pg_cron</option>
          <option value="edge_function">edge_function</option>
          <option value="automation">automation</option>
          <option value="manual">manual</option>
        </select>
        <select name="name" defaultValue={sp.name ?? ''} className="rounded-md border px-2 py-1">
          <option value="">all jobs</option>
          {uniqueJobs.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-[var(--zameen-700)] px-3 py-1 text-white">Filter</button>
      </form>

      <Card>
        <CardContent>
          <table className="w-full text-xs">
            <thead className="text-left text-[var(--ink)]/60">
              <tr>
                <th className="py-1">Name</th>
                <th className="py-1">Kind</th>
                <th className="py-1">Started</th>
                <th className="py-1">Duration</th>
                <th className="py-1">Status</th>
                <th className="py-1">Records</th>
                <th className="py-1">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--ink)]/5">
                  <td className="py-1 font-medium">
                    <Link href={`/admin/jobs/${r.id}`} className="underline">{r.jobName}</Link>
                  </td>
                  <td className="py-1">{r.jobKind}</td>
                  <td className="tabular py-1">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="tabular py-1">{r.durationMs ?? '-'} ms</td>
                  <td className="py-1">
                    <StatusLabel status={r.status} />
                  </td>
                  <td className="tabular py-1">{r.recordsProcessed ?? '-'}</td>
                  <td className="py-1 max-w-[24ch] truncate text-rose-700" title={r.errorMessage ?? ''}>
                    {r.errorMessage ?? ''}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="py-3 text-center text-[var(--ink)]/50">No job runs in this window.</td></tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
