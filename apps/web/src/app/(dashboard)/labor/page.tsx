import Link from 'next/link';
import { desc, eq, and, sql as dsql } from 'drizzle-orm';
import { db, workers, attendanceRecords } from '@zameen/db';
import { Masthead, SectionDivider, StatBlock, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LaborHome() {
  const today = new Date().toISOString().slice(0, 10);
  const totalWorkers = await db.select({ c: dsql<number>`count(*)::int` }).from(workers).where(eq(workers.isActive, true));
  const present = await db
    .select({ c: dsql<number>`count(*)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workDate, today), eq(attendanceRecords.status, 'present')));
  const recentAttendance = await db
    .select()
    .from(attendanceRecords)
    .orderBy(desc(attendanceRecords.checkInAt))
    .limit(15);

  const total = totalWorkers[0]?.c ?? 0;
  const here = present[0]?.c ?? 0;

  return (
    <div>
      <Masthead section="LABOR" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label="Workers active" value={total} />
        <StatBlock label="Present today" value={`${here} / ${total}`} caption="Geofence-verified" />
        <StatBlock label="Open tasks" value="—" />
        <StatBlock label="Payroll due" value="—" caption="this period" />
      </div>
      <SectionDivider label="Quick actions" />
      <div className="grid gap-3 md:grid-cols-4">
        <Link href={'/labor/workers' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">Workers</div><div className="font-display text-xl mt-1">Roster</div></Link>
        <Link href={'/labor/attendance' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">Attendance</div><div className="font-display text-xl mt-1">Grid</div></Link>
        <Link href={'/labor/piece-rate/new' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">Piece rate</div><div className="font-display text-xl mt-1">Log work</div></Link>
        <Link href={'/labor/payroll' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">Payroll</div><div className="font-display text-xl mt-1">Runs</div></Link>
      </div>
      <SectionDivider label="Recent attendance" />
      <Card>
        <CardHeader><CardTitle>Last check-ins</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recentAttendance.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No attendance records yet.</div>
          ) : (
            <ul>
              {recentAttendance.map((r) => (
                <li key={r.id} className="flex justify-between border-t border-[var(--rule)] px-4 py-2 first:border-t-0 text-sm">
                  <span className="font-mono">{fmtDate(r.workDate)} · {r.status}</span>
                  <span className="tabular text-[var(--ink)]/60">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
