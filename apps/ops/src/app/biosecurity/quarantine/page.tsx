import { eq, sql } from 'drizzle-orm';
import { db, quarantineRecords } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, StatBlock } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { ReleaseButton } from './release-button';

export const dynamic = 'force-dynamic';

export default async function QuarantinePage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const rows = entityId
    ? await db
        .select()
        .from(quarantineRecords)
        .where(eq(quarantineRecords.entityId, entityId))
        .orderBy(sql`${quarantineRecords.startDate} desc`)
    : [];

  const active = rows.filter((r) => r.status === 'active');
  const released = rows.filter((r) => r.status === 'released');

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <Masthead title="Quarantine" subtitle="Active isolation subjects" />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBlock label="Active" value={String(active.length)} />
        <StatBlock label="Released" value={String(released.length)} />
        <StatBlock label="Total" value={String(rows.length)} />
        <StatBlock label="Obs required" value={String(active.filter((a) => a.dailyObservationRequired).length)} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Active subjects</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">No active quarantine.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Kind</th>
                  <th>Subject</th>
                  <th>Reason</th>
                  <th>Since</th>
                  <th>Days</th>
                  <th>Obs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active.map((q) => {
                  const days = Math.floor((Date.now() - new Date(q.startDate as unknown as string).getTime()) / 86400_000);
                  return (
                    <tr key={q.id} className="border-t">
                      <td className="py-2">{q.subjectKind}</td>
                      <td className="font-mono text-xs">{q.subjectId ?? '-'}</td>
                      <td>{q.reason}</td>
                      <td>{q.startDate}</td>
                      <td>{days}</td>
                      <td>{q.dailyObservationRequired ? 'yes' : 'no'}</td>
                      <td>
                        <ReleaseButton id={q.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Released</CardTitle>
        </CardHeader>
        <CardContent>
          {released.length === 0 ? (
            <p className="text-sm text-slate-500">No releases yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {released.map((q) => (
                <li key={q.id} className="py-2">
                  <div className="flex justify-between">
                    <div>
                      <span className="font-medium">{q.subjectKind}</span> · {q.reason}
                    </div>
                    <div className="text-xs text-slate-500">
                      {q.startDate} - {q.endDate ?? '?'}
                    </div>
                  </div>
                  {q.releaseNotes && <div className="text-xs text-slate-500">{q.releaseNotes}</div>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
