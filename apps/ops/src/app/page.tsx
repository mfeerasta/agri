import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import {
  db,
  attendanceRecords,
  tasks,
  dieselDailyLogs,
  repairRequests,
  approvalRequests,
} from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, StatBlock, Pkr, EmptyState, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function OpsHome() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId;
  const t = today();

  const [presentToday] = entityId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.entityId, entityId),
            eq(attendanceRecords.workDate, t),
            eq(attendanceRecords.status, 'present'),
          ),
        )
    : [{ n: 0 }];

  const [scheduledTasks] = entityId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(eq(tasks.entityId, entityId), eq(tasks.scheduledFor, t)))
    : [{ n: 0 }];

  const [openRepairs] = entityId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(repairRequests)
        .where(
          and(
            eq(repairRequests.entityId, entityId),
            inArray(repairRequests.status, ['reported', 'quotes_pending', 'approval_pending', 'in_progress'] as never),
          ),
        )
    : [{ n: 0 }];

  const [pendingApprovals] = entityId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.entityId, entityId),
            ctx?.userId ? eq(approvalRequests.currentApproverId, ctx.userId) : isNull(approvalRequests.decidedAt),
            inArray(approvalRequests.state, ['submitted', 'in_review'] as never),
          ),
        )
    : [{ n: 0 }];

  const recentDiesel = entityId
    ? await db
        .select()
        .from(dieselDailyLogs)
        .where(and(eq(dieselDailyLogs.entityId, entityId), eq(dieselDailyLogs.logDate, t)))
        .orderBy(desc(dieselDailyLogs.createdAt))
        .limit(8)
    : [];

  const recentRepairs = entityId
    ? await db
        .select()
        .from(repairRequests)
        .where(and(eq(repairRequests.entityId, entityId), gte(repairRequests.reportedAt, new Date(t))))
        .orderBy(desc(repairRequests.reportedAt))
        .limit(8)
    : [];

  const completedTasks = entityId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(eq(tasks.entityId, entityId), eq(tasks.scheduledFor, t), eq(tasks.status, 'completed')))
    : [{ n: 0 }];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Ops Home" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock label="Workers in" value={presentToday?.n ?? 0} caption="checked in today" />
        <StatBlock
          label="Tasks today"
          value={`${completedTasks[0]?.n ?? 0}/${scheduledTasks?.n ?? 0}`}
          caption="completed / scheduled"
        />
        <StatBlock label="Open repairs" value={openRepairs?.n ?? 0} caption="awaiting close" />
        <StatBlock label="Approvals" value={pendingApprovals?.n ?? 0} caption="on your desk" />
      </div>

      <SectionDivider label="Today's activity" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diesel logged today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentDiesel.length === 0 ? (
              <EmptyState title="No diesel logs yet today" />
            ) : (
              <ul className="divide-y divide-[var(--rule)]">
                {recentDiesel.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{d.operatorName}</div>
                      <div className="text-xs text-[var(--ink)]/60">
                        {Number(d.dieselFilledLiters).toFixed(1)} L · {Number(d.hoursRun).toFixed(1)} hrs
                      </div>
                    </div>
                    <Pkr value={d.totalCostPkr} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repair requests opened today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentRepairs.length === 0 ? (
              <EmptyState title="No new repair requests" />
            ) : (
              <ul className="divide-y divide-[var(--rule)]">
                {recentRepairs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{r.requestNumber}</div>
                      <div className="text-xs text-[var(--ink)]/60 line-clamp-1">{r.issueDescription}</div>
                    </div>
                    <span className="smallcaps text-[0.7rem]">{r.severity}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
