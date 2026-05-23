import { eq, sql, and } from 'drizzle-orm';
import { db, diseaseOutbreaks } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, StatBlock } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { OutbreakForm } from './outbreak-form';
import { StatusButton } from './status-button';

export const dynamic = 'force-dynamic';

export default async function OutbreaksPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const rows = entityId
    ? await db
        .select()
        .from(diseaseOutbreaks)
        .where(eq(diseaseOutbreaks.entityId, entityId))
        .orderBy(sql`${diseaseOutbreaks.detectedOn} desc`)
    : [];

  const active = rows.filter((r) => r.status === 'active' || r.status === 'suspected');
  const contained = rows.filter((r) => r.status === 'contained');
  const resolved = rows.filter((r) => r.status === 'resolved');

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <Masthead title="Disease outbreaks" subtitle="Detection, containment, resolution" />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBlock label="Active" value={String(active.length)} />
        <StatBlock label="Contained" value={String(contained.length)} />
        <StatBlock label="Resolved" value={String(resolved.length)} />
        <StatBlock label="Total" value={String(rows.length)} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Report new outbreak</CardTitle>
        </CardHeader>
        <CardContent>
          <OutbreakForm />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Active and suspected</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">No active outbreaks.</p>
          ) : (
            <ul className="divide-y">
              {active.map((o) => (
                <li key={o.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{o.status}</span>{' '}
                        {o.outbreakKind.toUpperCase()}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Detected {o.detectedOn} · {o.affectedArea ?? 'no area'} · affected {o.totalAffectedCount ?? 0}
                      </div>
                      {o.notes && <div className="mt-1 text-sm">{o.notes}</div>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <StatusButton id={o.id} status="contained" label="Mark contained" />
                      <StatusButton id={o.id} status="resolved" label="Mark resolved" />
                      <StatusButton id={o.id} status="false_alarm" label="False alarm" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No outbreaks logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Kind</th>
                  <th>Detected</th>
                  <th>Status</th>
                  <th>Affected</th>
                  <th>Treatment cost (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-2">{o.outbreakKind}</td>
                    <td>{o.detectedOn}</td>
                    <td>{o.status}</td>
                    <td>{o.totalAffectedCount ?? '-'}</td>
                    <td>{o.totalTreatmentCostPkr ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
