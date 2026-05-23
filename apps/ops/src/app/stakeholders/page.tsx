import Link from 'next/link';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, stakeholders, stakeholderReports } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, StatBlock, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr + 'T00:00:00Z').getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((due - today) / 86400000);
}

export default async function StakeholdersHome() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) {
    return <EmptyState title="No entity in session" description="Sign in to view stakeholders." />;
  }

  const rows = await db
    .select()
    .from(stakeholders)
    .where(and(eq(stakeholders.entityId, entityId), eq(stakeholders.isActive, true)))
    .orderBy(asc(stakeholders.nextReportDue));

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      exposure: sql<number>`coalesce(sum(${stakeholders.exposurePkr}::numeric), 0)`,
    })
    .from(stakeholders)
    .where(and(eq(stakeholders.entityId, entityId), eq(stakeholders.isActive, true)));

  const [overdueCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(stakeholderReports)
    .innerJoin(stakeholders, eq(stakeholders.id, stakeholderReports.stakeholderId))
    .where(and(eq(stakeholders.entityId, entityId), eq(stakeholderReports.status, 'overdue')));

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Stakeholders" subtitle="Lenders, grants, investors, government reporting" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Active stakeholders" value={String(counts?.total ?? 0)} />
        <StatBlock label="Total exposure" value={<Pkr value={Math.round(Number(counts?.exposure ?? 0) * 100)} />} />
        <StatBlock label="Reports overdue" value={String(overdueCount?.n ?? 0)} />
        <StatBlock label="Next 30d due" value={String(rows.filter((r) => (daysUntil(r.nextReportDue) ?? 999) <= 30).length)} />
      </div>

      <div className="flex gap-3">
        <Link href="/stakeholders/reports/new" className="px-3 py-2 rounded bg-emerald-700 text-white text-sm">
          Generate report
        </Link>
        <Link href="/stakeholders/kpis" className="px-3 py-2 rounded border text-sm">
          Manage KPIs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporting calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No stakeholders" description="Add a lender, grant, or investor to start tracking." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1">Name</th>
                  <th>Kind</th>
                  <th>Frequency</th>
                  <th>Next due</th>
                  <th>Days</th>
                  <th className="text-right">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const days = daysUntil(r.nextReportDue);
                  const cls = days == null ? '' : days < 0 ? 'text-red-700 font-medium' : days <= 7 ? 'text-amber-700' : '';
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="py-2">
                        <Link href={`/stakeholders/${r.id}`} className="underline">
                          {r.name}
                        </Link>
                      </td>
                      <td>{r.stakeholderKind}</td>
                      <td>{r.reportingFrequency}</td>
                      <td>{r.nextReportDue ?? '—'}</td>
                      <td className={cls}>{days == null ? '—' : days}</td>
                      <td className="text-right">
                        {r.exposurePkr ? <Pkr value={Math.round(Number(r.exposurePkr) * 100)} /> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
