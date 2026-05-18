import Link from 'next/link';
import { and, desc, eq, gt } from 'drizzle-orm';
import { db, workerScorePeriods, workers, entities } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BonusRunsPage() {
  const [ent] = await db.select().from(entities).limit(1);
  const entityId = ent?.id as string | undefined;
  const rows = entityId
    ? await db
        .select()
        .from(workerScorePeriods)
        .where(and(eq(workerScorePeriods.entityId, entityId), eq(workerScorePeriods.bonusEligible, true)))
        .orderBy(desc(workerScorePeriods.periodStart))
    : [];

  // Group by period
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.periodStart as string}_${r.periodEnd as string}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }

  const workerIds = Array.from(new Set(rows.map((r) => r.workerId as string)));
  const wlist = workerIds.length && entityId ? await db.select().from(workers).where(eq(workers.entityId, entityId)) : [];
  const wmap = new Map<string, (typeof wlist)[number]>();
  for (const w of wlist) wmap.set(w.id as string, w);

  return (
    <div>
      <Masthead section="BONUS RUNS" />
      <SectionDivider />
      <div className="mb-3 text-xs text-[var(--ink)]/60">
        Each run is a periods set with bonus_eligible workers. Amounts roll into the next payroll run pending approval.
      </div>
      {groups.size === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-[var(--ink)]/50">No bonus runs yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([key, bucket]) => {
            const [s, e] = key.split('_');
            const total = bucket.reduce((acc, r) => acc + Number(r.bonusAmountPkr ?? 0), 0);
            return (
              <Card key={key}>
                <CardHeader className="flex justify-between items-baseline">
                  <CardTitle>
                    {fmtDate(s)} → {fmtDate(e)}
                  </CardTitle>
                  <Pkr value={total.toFixed(2)} mode="lac_crore" />
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                      <tr>
                        <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Rank</th>
                        <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Worker</th>
                        <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Score</th>
                        <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Bonus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bucket.map((r) => {
                        const w = wmap.get(r.workerId as string);
                        return (
                          <tr key={r.id as string} className="border-t border-[var(--rule)]">
                            <td className="px-3 py-2 tabular">{r.rankInPeriod as number}</td>
                            <td className="px-3 py-2">{w?.fullName ?? (r.workerId as string)}</td>
                            <td className="px-3 py-2 text-right tabular">{Number(r.compositeScore).toFixed(1)}</td>
                            <td className="px-3 py-2 text-right">
                              <Pkr value={r.bonusAmountPkr as string} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <div className="mt-4">
        <Link
          href={'/labor/leaderboard' as never}
          className="text-xs text-[var(--ink)]/70 hover:underline"
        >
          ← Back to leaderboard
        </Link>
      </div>
    </div>
  );
}
