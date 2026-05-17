import { db, users, workers, taskCompletions } from '@zameen/db';
import { sql, desc, gte, eq, and } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, StatBlock, ChartCard } from '@zameen/ui';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;

interface SeriesPoint { day: string; count: number }

export default async function PlatformAnalyticsPage() {
  const session = await getSessionContext();
  if (!session || !['director', 'super_admin'].includes(session.role)) {
    redirect('/');
  }

  const since = new Date(Date.now() - 30 * DAY);
  const sinceWau = new Date(Date.now() - 7 * DAY);

  // DAU per day (last 30 days)
  const dauRows = await db.execute<{ day: string; users: number }>(sql`
    select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as day,
           count(distinct user_id)::int as users
    from zameen.platform_events
    where occurred_at >= ${since}
    group by 1
    order by 1
  `);
  const dauSeries: SeriesPoint[] = (dauRows as unknown as { day: string; users: number }[]).map((r) => ({ day: r.day, count: Number(r.users) }));

  // WAU summary
  const wauRow = await db.execute<{ users: number }>(sql`
    select count(distinct user_id)::int as users
    from zameen.platform_events
    where occurred_at >= ${sinceWau}
  `);
  const wau = Number((wauRow as unknown as { users: number }[])[0]?.users ?? 0);

  // Top events
  const topEventsRows = await db.execute<{ event_name: string; n: number }>(sql`
    select event_name, count(*)::int as n
    from zameen.platform_events
    where occurred_at >= ${since}
    group by event_name
    order by n desc
    limit 20
  `);
  const topEvents = (topEventsRows as unknown as { event_name: string; n: number }[]);

  // AI assistant calls / day
  const aiRows = await db.execute<{ day: string; n: number }>(sql`
    select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as day,
           count(*)::int as n
    from zameen.platform_events
    where occurred_at >= ${since} and event_name = 'ai_assistant_invoked'
    group by 1
    order by 1
  `);
  const aiSeries: SeriesPoint[] = (aiRows as unknown as { day: string; n: number }[]).map((r) => ({ day: r.day, count: Number(r.n) }));

  // Approval throughput
  const approvalRows = await db.execute<{ day: string; n: number }>(sql`
    select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as day,
           count(*)::int as n
    from zameen.platform_events
    where occurred_at >= ${since} and event_name = 'approval_decided'
    group by 1
    order by 1
  `);
  const approvalSeries: SeriesPoint[] = (approvalRows as unknown as { day: string; n: number }[]).map((r) => ({ day: r.day, count: Number(r.n) }));

  // Top 10 most active workers (by completed tasks in window, training rows excluded)
  const topWorkers = await db
    .select({
      workerId: taskCompletions.workerId,
      workerName: workers.fullName,
      n: sql<number>`count(*)::int`,
    })
    .from(taskCompletions)
    .leftJoin(workers, eq(workers.id, taskCompletions.workerId))
    .where(and(gte(taskCompletions.completedAt, since), eq(taskCompletions.isTraining, false)))
    .groupBy(taskCompletions.workerId, workers.fullName)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return (
    <div>
      <Masthead section="PLATFORM ANALYTICS" />
      <SectionDivider label="Activity" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBlock label="WAU (7d)" value={String(wau)} caption="Distinct users with any event" />
        <StatBlock label="DAU today" value={String(dauSeries[dauSeries.length - 1]?.count ?? 0)} />
        <StatBlock label="AI calls (30d)" value={String(aiSeries.reduce((a, b) => a + b.count, 0))} />
        <StatBlock label="Approvals decided (30d)" value={String(approvalSeries.reduce((a, b) => a + b.count, 0))} />
      </div>

      <SectionDivider label="DAU (30 days)" />
      <ChartCard title="Distinct users per day" data={dauSeries} xKey="day" yKey="count" unit="users" />

      <SectionDivider label="AI assistant usage" />
      <ChartCard title="Calls per day" data={aiSeries} xKey="day" yKey="count" unit="calls" />

      <SectionDivider label="Approval throughput" />
      <ChartCard title="Decisions per day" data={approvalSeries} xKey="day" yKey="count" unit="decisions" />

      <SectionDivider label="Top events (30 days)" />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Event</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Count</th>
              </tr>
            </thead>
            <tbody>
              {topEvents.map((e) => (
                <tr key={e.event_name} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{e.event_name}</td>
                  <td className="px-3 py-2 text-right tabular">{e.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SectionDivider label="Top 10 most active workers (30 days)" />
      <Card>
        <CardHeader><CardTitle>By task completions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Worker</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {topWorkers.map((w) => (
                <tr key={w.workerId ?? 'unknown'} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2">{w.workerName ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular">{w.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
