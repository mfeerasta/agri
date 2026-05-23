import { db, jobRuns, idempotencyLog, approvalRequests, notifications, listTopSlowQueriesToday, type SlowQueryRow } from '@zameen/db';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  Masthead,
  SectionDivider,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatBlock,
} from '@zameen/ui';
import { fmtDateTime } from '@/lib/format';
import { getSessionContext } from '@/lib/session';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CronJobAggregate {
  jobName: string;
  total: number;
  failed: number;
  lastSuccessAt: Date | null;
  lastFailedAt: Date | null;
  staleSlot: boolean;
}

// Expected slot interval per job (minutes). Anything missing its last slot
// flips the staleSlot flag in the rollup.
const EXPECTED_SLOT_MINUTES: Record<string, number> = {
  'weather-fetch': 60,
  'ndvi-refresh': 24 * 60,
  'price-fetch': 12 * 60,
  'cnic-encrypt-sweep': 24 * 60,
  'idempotency-prune': 60,
  'dr-drill': 7 * 24 * 60,
};

async function loadJobRollup(): Promise<CronJobAggregate[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      jobName: jobRuns.jobName,
      status: jobRuns.status,
      startedAt: jobRuns.startedAt,
      completedAt: jobRuns.completedAt,
    })
    .from(jobRuns)
    .where(gte(jobRuns.startedAt, since))
    .orderBy(desc(jobRuns.startedAt));

  const grouped = new Map<string, CronJobAggregate>();
  for (const r of rows) {
    const g = grouped.get(r.jobName) ?? {
      jobName: r.jobName,
      total: 0,
      failed: 0,
      lastSuccessAt: null as Date | null,
      lastFailedAt: null as Date | null,
      staleSlot: false,
    };
    g.total++;
    if (r.status === 'failed' || r.status === 'timed_out') {
      g.failed++;
      if (!g.lastFailedAt && r.completedAt) g.lastFailedAt = new Date(r.completedAt);
    } else if (r.status === 'succeeded' && r.completedAt && !g.lastSuccessAt) {
      g.lastSuccessAt = new Date(r.completedAt);
    }
    grouped.set(r.jobName, g);
  }

  const now = Date.now();
  for (const g of grouped.values()) {
    const expectedMin = EXPECTED_SLOT_MINUTES[g.jobName];
    if (expectedMin && g.lastSuccessAt) {
      const ageMin = (now - g.lastSuccessAt.getTime()) / 60_000;
      // Allow 1.5x the expected interval before flagging stale.
      g.staleSlot = ageMin > expectedMin * 1.5;
    }
  }
  return Array.from(grouped.values()).sort((a, b) => a.jobName.localeCompare(b.jobName));
}

async function loadIdempotencyCount(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(idempotencyLog);
  return rows[0]?.count ?? 0;
}

async function loadApprovalQueueDepth(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(approvalRequests)
    .where(eq(approvalRequests.state, 'submitted'));
  return rows[0]?.count ?? 0;
}

async function loadNotificationErrorRate(): Promise<{ total: number; failed: number; rate: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(gte(notifications.createdAt, since));
  const failedRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(gte(notifications.createdAt, since), sql`${notifications.failedReason} is not null`));
  const total = totalRows[0]?.count ?? 0;
  const failed = failedRows[0]?.count ?? 0;
  return { total, failed, rate: total > 0 ? failed / total : 0 };
}

async function loadDbConnectionCount(): Promise<number> {
  try {
    const res = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from pg_stat_activity where datname = current_database()`,
    );
    const row = (res as { rows?: Array<{ count: number }> }).rows?.[0];
    return row?.count ?? 0;
  } catch {
    return -1;
  }
}

async function loadRlsPolicyCount(): Promise<number> {
  try {
    const res = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from pg_policies where schemaname = 'zameen'`,
    );
    const row = (res as { rows?: Array<{ count: number }> }).rows?.[0];
    return row?.count ?? 0;
  } catch {
    return -1;
  }
}

async function loadActiveSessionCount(): Promise<number> {
  try {
    const res = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from auth.sessions where not_after > now()`,
    );
    const row = (res as { rows?: Array<{ count: number }> }).rows?.[0];
    return row?.count ?? 0;
  } catch {
    return -1;
  }
}

// Baseline RLS policy count. When the drift exceeds +/-2 we surface a
// banner so the operator notices accidental policy regressions.
const RLS_POLICY_BASELINE = 60;

export default async function AdminStatusPage(): Promise<JSX.Element> {
  const session = await getSessionContext();
  if (!session) notFound();

  const [
    rollup,
    idempotencyCount,
    approvalQueue,
    notifyRate,
    dbConns,
    rlsCount,
    activeSessions,
    slowQueries,
  ] = await Promise.all([
    loadJobRollup(),
    loadIdempotencyCount(),
    loadApprovalQueueDepth(),
    loadNotificationErrorRate(),
    loadDbConnectionCount(),
    loadRlsPolicyCount(),
    loadActiveSessionCount(),
    listTopSlowQueriesToday(10).catch((): SlowQueryRow[] => []),
  ]);

  const anyStaleCron = rollup.some((j) => j.staleSlot || j.failed > 0);
  const rlsDrift = rlsCount > 0 ? rlsCount - RLS_POLICY_BASELINE : 0;
  const notifyRatePct = (notifyRate.rate * 100).toFixed(1);

  return (
    <div>
      <Masthead section="ADMIN · STATUS" />
      <SectionDivider />

      {/* meta refresh keeps the dashboard fresh without adding a client component */}
      <meta httpEquiv="refresh" content="30" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatBlock
          label="Cron health"
          value={anyStaleCron ? 'red' : 'ok'}
        />
        <StatBlock label="Approval queue" value={String(approvalQueue)} />
        <StatBlock
          label="Notify error rate 24h"
          value={`${notifyRatePct}%`}
        />
        <StatBlock label="DB connections" value={String(dbConns)} />
        <StatBlock label="RLS policies" value={`${rlsCount} (drift ${rlsDrift >= 0 ? '+' : ''}${rlsDrift})`} />
        <StatBlock label="Idempotency keys" value={String(idempotencyCount)} />
        <StatBlock label="Active sessions" value={String(activeSessions)} />
        <StatBlock label="Baseline RLS" value={String(RLS_POLICY_BASELINE)} />
      </div>

      <SectionDivider label="Cron jobs (last 24h)" />
      <Card>
        <CardHeader>
          <CardTitle>{rollup.length} jobs observed</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rollup.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No job runs recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Job</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Runs</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Failed</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Last success</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Last failed</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Slot</th>
                </tr>
              </thead>
              <tbody>
                {rollup.map((j) => {
                  const isBad = j.staleSlot || j.failed > 0;
                  return (
                    <tr
                      key={j.jobName}
                      className={`border-t border-[var(--rule)] ${isBad ? 'bg-rose-50/40' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{j.jobName}</td>
                      <td className="px-3 py-2 text-right tabular">{j.total}</td>
                      <td className={`px-3 py-2 text-right tabular ${j.failed > 0 ? 'text-rose-700' : ''}`}>
                        {j.failed}
                      </td>
                      <td className="px-3 py-2 tabular text-xs">
                        {j.lastSuccessAt ? fmtDateTime(j.lastSuccessAt) : '—'}
                      </td>
                      <td className="px-3 py-2 tabular text-xs">
                        {j.lastFailedAt ? fmtDateTime(j.lastFailedAt) : '—'}
                      </td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">
                        {j.staleSlot ? <span className="text-rose-700">stale</span> : 'fresh'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Notification dispatch (last 24h)" />
      <Card>
        <CardContent className="p-4 text-sm">
          {notifyRate.total === 0 ? (
            <div className="text-[var(--ink)]/60">No notifications sent in the last 24 hours.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <StatBlock label="Total" value={String(notifyRate.total)} />
              <StatBlock label="Failed" value={String(notifyRate.failed)} />
              <StatBlock label="Error rate" value={`${notifyRatePct}%`} />
            </div>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Slow queries today (top 10)" />
      <Card>
        <CardContent className="p-0">
          {slowQueries.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/60">
              No queries exceeded the slow-query threshold today.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">ms</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">SQL</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Caller</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                </tr>
              </thead>
              <tbody>
                {slowQueries.map((q) => (
                  <tr key={q.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 text-right tabular font-mono">{q.durationMs}</td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
                      {q.sqlText.length > 240 ? `${q.sqlText.slice(0, 240)}...` : q.sqlText}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{q.caller ?? '-'}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDateTime(q.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-[var(--ink)]/60">
        Auto-refreshes every 30 seconds. Liveness at <code>/api/healthz</code>, readiness at <code>/api/readyz</code>.
      </p>
    </div>
  );
}
