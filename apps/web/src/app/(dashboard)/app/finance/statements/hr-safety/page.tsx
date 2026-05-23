import { desc, eq, gte, and, sql as dsql } from 'drizzle-orm';
import { db, safetyIncidents, workers, attendanceRecords, trainingPrograms, trainingCompletions } from '@zameen/db';
import { Masthead, SectionDivider, StatBlock, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function HrSafetyDashboardPage() {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const since = new Date(today.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [incidents, wdRows, activeWorkers, programs, completions] = await Promise.all([
    db.select().from(safetyIncidents).where(gte(safetyIncidents.occurredAt, new Date(since))),
    db.select({ c: dsql<number>`count(*)::int` }).from(attendanceRecords).where(and(gte(attendanceRecords.workDate, since), eq(attendanceRecords.status, 'present'))),
    db.select({ c: dsql<number>`count(*)::int` }).from(workers).where(eq(workers.isActive, true)),
    db.select({ id: trainingPrograms.id, name: trainingPrograms.name }).from(trainingPrograms).where(eq(trainingPrograms.isActive, true)),
    db.select({ workerId: trainingCompletions.workerId, programId: trainingCompletions.programId, expiresOn: trainingCompletions.expiresOn }).from(trainingCompletions),
  ]);

  const workerDays = wdRows[0]?.c ?? 0;
  const totalWorkers = activeWorkers[0]?.c ?? 0;
  const open = incidents.filter((i) => i.status !== 'closed').length;
  const lti = incidents.filter((i) => i.severity === 'lost_time' || i.severity === 'fatality');
  const lostDaysSum = incidents.reduce((s, i) => s + (i.lostDays ?? 0), 0);
  const ltiRate = workerDays > 0 ? Number(((lti.length / workerDays) * 200000).toFixed(2)) : 0;

  const validByWorker = new Map<string, Set<string>>();
  for (const c of completions) {
    if (c.expiresOn && c.expiresOn < todayIso) continue;
    const set = validByWorker.get(c.workerId) ?? new Set();
    set.add(c.programId);
    validByWorker.set(c.workerId, set);
  }
  const total = programs.length * totalWorkers;
  let valid = 0;
  for (const s of validByWorker.values()) valid += s.size;
  const trainingCompliancePct = total === 0 ? 0 : Math.round((valid / total) * 100);

  const medicalCostPkr = incidents.reduce((s, i) => s + Number(i.medicalCostPkr ?? 0), 0);

  return (
    <div>
      <Masthead section="HR & SAFETY DASHBOARD" />
      <SectionDivider />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-[var(--rule)]">
        <StatBlock label="Open incidents" value={open} />
        <StatBlock label="LTI rate (per 200k hrs)" value={ltiRate} caption="OSHA-style" />
        <StatBlock label="Lost-time days" value={lostDaysSum} caption="rolling 12 mo" />
        <StatBlock label="Training compliance" value={`${trainingCompliancePct}%`} />
        <StatBlock label="Medical cost (PKR)" value={medicalCostPkr.toLocaleString('en-PK')} />
      </div>

      <SectionDivider label="LTI incidents (rolling 12 months)" />
      <Card>
        <CardContent className="p-0">
          {lti.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No lost-time or fatality incidents on record.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Severity</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Lost days</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {lti.map((i) => (
                  <tr key={i.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{new Date(i.occurredAt).toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.severity}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.category ?? ''}</td>
                    <td className="px-3 py-2 text-right tabular">{i.lostDays}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.status}</td>
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
