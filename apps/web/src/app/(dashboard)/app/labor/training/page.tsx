import Link from 'next/link';
import { desc, eq, and, sql as dsql } from 'drizzle-orm';
import { db, workers, trainingPrograms, trainingCompletions } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

type CellStatus = 'completed' | 'expired' | 'never';

function statusFor(completedOn: string | null, expiresOn: string | null, today: string): CellStatus {
  if (!completedOn) return 'never';
  if (expiresOn && expiresOn < today) return 'expired';
  return 'completed';
}

export default async function TrainingMatrixPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [programs, roster, completions] = await Promise.all([
    db.select().from(trainingPrograms).where(eq(trainingPrograms.isActive, true)).orderBy(trainingPrograms.category, trainingPrograms.name),
    db.select().from(workers).where(eq(workers.isActive, true)).orderBy(workers.fullName).limit(300),
    db
      .select({
        workerId: trainingCompletions.workerId,
        programId: trainingCompletions.programId,
        completedOn: trainingCompletions.completedOn,
        expiresOn: trainingCompletions.expiresOn,
        passed: trainingCompletions.passed,
      })
      .from(trainingCompletions)
      .orderBy(desc(trainingCompletions.completedOn)),
  ]);

  const latest = new Map<string, { completedOn: string | null; expiresOn: string | null }>();
  for (const c of completions) {
    const key = `${c.workerId}:${c.programId}`;
    if (!latest.has(key)) latest.set(key, { completedOn: c.completedOn, expiresOn: c.expiresOn });
  }

  const compliancePct = (() => {
    if (programs.length === 0 || roster.length === 0) return 0;
    let valid = 0;
    let total = 0;
    for (const w of roster) {
      for (const p of programs) {
        total++;
        const cell = latest.get(`${w.id}:${p.id}`);
        if (cell && statusFor(cell.completedOn, cell.expiresOn, today) === 'completed') valid++;
      }
    }
    return total === 0 ? 0 : Math.round((valid / total) * 100);
  })();

  return (
    <div>
      <Masthead section="TRAINING" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">
          Programs · {programs.length} · Workers · {roster.length} · Compliance · {compliancePct}%
        </div>
        <div className="flex gap-2">
          <Link href={'/labor/training/programs/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">New program</Link>
          <Link href={'/labor/training/completions/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Log completion</Link>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Workers and Programs</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {programs.length === 0 || roster.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No programs or workers yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem] sticky left-0 bg-[var(--paper-2)]">Worker</th>
                  {programs.map((p) => (
                    <th key={p.id} className="smallcaps text-center px-2 py-2 text-[0.65rem] whitespace-nowrap">
                      <div>{p.name}</div>
                      <div className="text-[var(--ink)]/50">{p.category}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((w) => (
                  <tr key={w.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 sticky left-0 bg-[var(--paper)] font-mono text-xs">
                      <Link href={`/labor/workers/${w.id}` as never} className="hover:underline">{w.fullName}</Link>
                    </td>
                    {programs.map((p) => {
                      const cell = latest.get(`${w.id}:${p.id}`);
                      const s = cell ? statusFor(cell.completedOn, cell.expiresOn, today) : 'never';
                      const bg = s === 'completed' ? 'bg-emerald-100 text-emerald-900' : s === 'expired' ? 'bg-amber-100 text-amber-900' : 'bg-rose-50 text-rose-900';
                      const label = s === 'completed' ? fmtDate(cell?.completedOn ?? null) : s === 'expired' ? 'expired' : 'never';
                      return (
                        <td key={p.id} className={`px-2 py-2 text-center text-[0.7rem] ${bg}`}>{label}</td>
                      );
                    })}
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
