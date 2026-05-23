import Link from 'next/link';
import { desc, eq, gte, and, sql as dsql, isNotNull } from 'drizzle-orm';
import {
  db,
  safetyIncidents,
  workers,
  attendanceRecords,
  trainingPrograms,
  trainingCompletions,
} from '@zameen/db';
import { Masthead, SectionDivider, StatBlock, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const SAFETY_CATEGORIES = [
  'pesticide_exposure',
  'machinery',
  'heat_stress',
  'fall',
  'animal',
  'electrical',
  'fire',
  'snake_bite',
  'other',
] as const;

const SEVERITIES = ['near_miss', 'first_aid', 'medical_treatment', 'lost_time', 'fatality', 'property_only'] as const;

export default async function SafetyHubPage() {
  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [incidents, workerDayRows, programs, validCompletions, workerCount] = await Promise.all([
    db.select().from(safetyIncidents).where(gte(safetyIncidents.occurredAt, new Date(ninetyDaysAgo))).orderBy(desc(safetyIncidents.occurredAt)),
    db
      .select({ c: dsql<number>`count(*)::int` })
      .from(attendanceRecords)
      .where(and(gte(attendanceRecords.workDate, ninetyDaysAgo), eq(attendanceRecords.status, 'present'))),
    db.select({ id: trainingPrograms.id }).from(trainingPrograms).where(eq(trainingPrograms.isActive, true)),
    db.select({ workerId: trainingCompletions.workerId, programId: trainingCompletions.programId, expiresOn: trainingCompletions.expiresOn, completedOn: trainingCompletions.completedOn }).from(trainingCompletions),
    db.select({ c: dsql<number>`count(*)::int` }).from(workers).where(eq(workers.isActive, true)),
  ]);

  const workerDays = workerDayRows[0]?.c ?? 0;
  const programCount = programs.length;
  const totalWorkers = workerCount[0]?.c ?? 0;

  const open = incidents.filter((i) => i.status !== 'closed').length;
  const lti = incidents.filter((i) => i.severity === 'lost_time' || i.severity === 'fatality').length;
  const lostDaysSum = incidents.reduce((s, i) => s + (i.lostDays ?? 0), 0);
  const incidentRatePer100 = workerDays > 0 ? Number(((incidents.length / workerDays) * 100).toFixed(2)) : 0;
  const ltiPer100 = workerDays > 0 ? Number(((lti / workerDays) * 100).toFixed(2)) : 0;

  const todayStr = today.toISOString().slice(0, 10);
  const validByWorker = new Map<string, Set<string>>();
  for (const c of validCompletions) {
    if (c.expiresOn && c.expiresOn < todayStr) continue;
    const set = validByWorker.get(c.workerId) ?? new Set();
    set.add(c.programId);
    validByWorker.set(c.workerId, set);
  }
  const trainingCompliancePct = (() => {
    if (programCount === 0 || totalWorkers === 0) return 0;
    let valid = 0;
    for (const set of validByWorker.values()) valid += set.size;
    const total = programCount * totalWorkers;
    return total === 0 ? 0 : Math.round((valid / total) * 100);
  })();

  const correctiveTotal = incidents.filter((i) => i.correctiveAction).length;
  const correctiveClosed = incidents.filter((i) => i.correctiveActionCompletedOn).length;
  const correctiveClosePct = correctiveTotal === 0 ? 0 : Math.round((correctiveClosed / correctiveTotal) * 100);

  const heatmap: Record<string, Record<string, number>> = {};
  for (const cat of SAFETY_CATEGORIES) {
    heatmap[cat] = {};
    for (const sev of SEVERITIES) heatmap[cat][sev] = 0;
  }
  for (const i of incidents) {
    const cat = i.category ?? 'other';
    if (heatmap[cat]) heatmap[cat][i.severity] = (heatmap[cat][i.severity] ?? 0) + 1;
  }
  const maxCell = Math.max(1, ...SAFETY_CATEGORIES.flatMap((c) => SEVERITIES.map((s) => heatmap[c][s])));

  return (
    <div>
      <Masthead section="SAFETY" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">Rolling 90 days</div>
        <Link href={'/labor/safety/incidents/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Report incident</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-[var(--rule)]">
        <StatBlock label="Open incidents" value={open} />
        <StatBlock label="Incidents per 100 worker-days" value={incidentRatePer100} />
        <StatBlock label="LTI per 100 worker-days" value={ltiPer100} caption={`${lostDaysSum} lost-days`} />
        <StatBlock label="Training compliance" value={`${trainingCompliancePct}%`} />
        <StatBlock label="Corrective close rate" value={`${correctiveClosePct}%`} />
      </div>

      <SectionDivider label="Heatmap by category and severity" />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                {SEVERITIES.map((s) => <th key={s} className="smallcaps text-center px-2 py-2 text-[0.65rem]">{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {SAFETY_CATEGORIES.map((cat) => (
                <tr key={cat} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{cat}</td>
                  {SEVERITIES.map((sev) => {
                    const n = heatmap[cat][sev];
                    const intensity = Math.round((n / maxCell) * 100);
                    const bg = n === 0 ? 'bg-[var(--paper)]' : `bg-rose-${intensity > 60 ? '300' : intensity > 30 ? '200' : '100'}`;
                    return <td key={sev} className={`px-2 py-2 text-center text-xs ${bg}`}>{n || ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SectionDivider label="Recent incidents" />
      <Card>
        <CardContent className="p-0">
          {incidents.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No incidents in the last 90 days.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Severity</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Description</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Corrective due</th>
                </tr>
              </thead>
              <tbody>
                {incidents.slice(0, 50).map((i) => (
                  <tr key={i.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(i.occurredAt)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.severity}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.category ?? ''}</td>
                    <td className="px-3 py-2 text-xs max-w-md truncate">{i.description}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{i.status}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(i.correctiveActionDueOn)}</td>
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
