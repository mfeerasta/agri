import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db, attendanceRecords, workers } from '@zameen/db';
import { and, eq } from 'drizzle-orm';
import { getFieldSession } from '../../lib/session';
import { Masthead } from '@zameen/ui';
import { AttendanceClient } from './attendance-client';
import { AttendanceCalendar } from './attendance-calendar';
import { fetchMonthAttendance } from './actions';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendancePage() {
  const session = await getFieldSession();
  if (!session) redirect('/login');

  let workerId = session.workerId;
  if (!workerId) {
    const rows = await db
      .select({ id: workers.id })
      .from(workers)
      .where(and(eq(workers.userId, session.userId), eq(workers.entityId, session.entityId)))
      .limit(1);
    workerId = rows[0]?.id ?? null;
  }

  let todayRecord: { checkInAt: Date | null; checkOutAt: Date | null; withinGeofence: boolean | null } | null = null;
  if (workerId) {
    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.workerId, workerId), eq(attendanceRecords.workDate, todayIso())))
      .limit(1);
    if (rows[0]) {
      todayRecord = {
        checkInAt: rows[0].checkInAt,
        checkOutAt: rows[0].checkOutAt,
        withinGeofence: rows[0].withinGeofence,
      };
    }
  }

  const month = await fetchMonthAttendance();

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Home</Link>
      <Masthead section="Hazri" />
      <AttendanceClient
        checkedIn={!!todayRecord?.checkInAt}
        checkedOut={!!todayRecord?.checkOutAt}
        withinGeofence={todayRecord?.withinGeofence ?? null}
      />
      <AttendanceCalendar records={month} />
    </main>
  );
}
