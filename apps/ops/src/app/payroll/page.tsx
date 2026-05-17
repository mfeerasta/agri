import { and, eq, sql } from 'drizzle-orm';
import { db, workers, attendanceRecords, pieceRateLogs } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PayrollPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const t = today();

  const rows = entityId
    ? await db
        .select({
          workerId: workers.id,
          code: workers.code,
          fullName: workers.fullName,
          workerType: workers.workerType,
          status: attendanceRecords.status,
          checkInAt: attendanceRecords.checkInAt,
          pieceTotal: sql<number>`coalesce((select sum(${pieceRateLogs.totalPkr})::numeric from zameen.piece_rate_logs where worker_id = ${workers.id} and work_date = ${t}), 0)`,
          pieceCount: sql<number>`coalesce((select count(*)::int from zameen.piece_rate_logs where worker_id = ${workers.id} and work_date = ${t}), 0)`,
        })
        .from(workers)
        .leftJoin(
          attendanceRecords,
          and(eq(attendanceRecords.workerId, workers.id), eq(attendanceRecords.workDate, t)),
        )
        .where(and(eq(workers.entityId, entityId), eq(workers.isActive, true)))
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Masthead section="Payroll Review" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today · {t}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No workers on file" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--rule)] text-left smallcaps text-[0.7rem]">
                    <th className="py-2">Worker</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Piece entries</th>
                    <th className="text-right">Piece total</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const flag = r.pieceCount > 0 && r.status === 'absent';
                    return (
                      <tr key={r.workerId} className={`border-b border-[var(--rule)] ${flag ? 'bg-[var(--rust)]/10' : ''}`}>
                        <td className="py-2">
                          <div className="font-medium">{r.fullName}</div>
                          <div className="text-xs text-[var(--ink)]/60">{r.code}</div>
                        </td>
                        <td>{r.workerType.replace('_', ' ')}</td>
                        <td className="smallcaps text-[0.7rem]">{r.status ?? 'unmarked'}</td>
                        <td className="tabular-nums">
                          {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="tabular-nums">{r.pieceCount}</td>
                        <td className="text-right">
                          <Pkr value={String(r.pieceTotal ?? 0)} />
                        </td>
                        <td>{flag ? <span className="smallcaps text-[var(--rust)]">mismatch</span> : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
