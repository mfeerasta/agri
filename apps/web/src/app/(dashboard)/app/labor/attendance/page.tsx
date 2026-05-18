import { desc, gte } from 'drizzle-orm';
import { db, attendanceRecords } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(attendanceRecords)
    .where(gte(attendanceRecords.workDate, since))
    .orderBy(desc(attendanceRecords.workDate))
    .limit(500);

  return (
    <div>
      <Masthead section="ATTENDANCE" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Last 30 days</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No attendance recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Worker</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">In</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Out</th>
                  <th className="smallcaps text-center px-3 py-2 text-[0.7rem]">Geo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.workDate)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.workerId.slice(0, 8)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.status}</td>
                    <td className="px-3 py-2 text-right tabular text-xs">
                      {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-xs">
                      {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.withinGeofence == null ? '—' : r.withinGeofence ? '✓' : <span className="text-[var(--rust)]">✕</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
