import Link from 'next/link';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db, workers, workerScorePeriods, entities } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { ScoreBar } from './score-bar';

export const dynamic = 'force-dynamic';

type PageProps = { searchParams?: Promise<Record<string, string | undefined>> };

function lastNMonths(n: number): Array<{ start: string; end: string; label: string }> {
  const out: Array<{ start: string; end: string; label: string }> = [];
  const ref = new Date();
  const pkt = new Date(ref.getTime() + 5 * 60 * 60 * 1000);
  for (let i = 1; i <= n; i += 1) {
    const y = pkt.getUTCFullYear();
    const m = pkt.getUTCMonth() - i + 1;
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    const sIso = start.toISOString().slice(0, 10);
    const eIso = end.toISOString().slice(0, 10);
    out.push({
      start: sIso,
      end: eIso,
      label: start.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' }),
    });
  }
  return out;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const periods = lastNMonths(12);
  const selectedPeriod = sp.period ?? periods[0]!.start;
  const period = periods.find((p) => p.start === selectedPeriod) ?? periods[0]!;
  const sortBy = sp.sort ?? 'score';

  const [ent] = await db.select().from(entities).limit(1);
  const entityId = ent?.id as string | undefined;

  const rows = entityId
    ? await db
        .select()
        .from(workerScorePeriods)
        .where(
          and(
            eq(workerScorePeriods.entityId, entityId),
            gte(workerScorePeriods.periodStart, period.start),
            lte(workerScorePeriods.periodEnd, period.end),
          ),
        )
        .orderBy(desc(workerScorePeriods.compositeScore))
    : [];

  const workerIds = rows.map((r) => r.workerId as string);
  const workerList = workerIds.length
    ? await db.select().from(workers).where(eq(workers.entityId, entityId!))
    : [];
  const workerMap = new Map<string, (typeof workerList)[number]>();
  for (const w of workerList) workerMap.set(w.id as string, w);

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'tasks') return (b.tasksCompleted as number) - (a.tasksCompleted as number);
    if (sortBy === 'piece') return Number(b.pieceRateTotalPkr) - Number(a.pieceRateTotalPkr);
    if (sortBy === 'attendance') return (b.daysPresent as number) - (a.daysPresent as number);
    return Number(b.compositeScore) - Number(a.compositeScore);
  });

  const top3 = [...rows].sort((a, b) => Number(b.compositeScore) - Number(a.compositeScore)).slice(0, 3);

  return (
    <div>
      <Masthead section="LEADERBOARD" />
      <SectionDivider />
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex gap-2 items-center">
          <span className="smallcaps text-xs text-[var(--ink)]/70">Period</span>
          <form className="flex gap-2">
            <select
              name="period"
              defaultValue={period.start}
              className="border border-[var(--rule)] px-2 py-1 text-sm bg-[var(--paper)]"
            >
              {periods.map((p) => (
                <option key={p.start} value={p.start}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={sortBy}
              className="border border-[var(--rule)] px-2 py-1 text-sm bg-[var(--paper)]"
            >
              <option value="score">Composite score</option>
              <option value="tasks">Tasks completed</option>
              <option value="piece">Piece-rate Rs.</option>
              <option value="attendance">Attendance</option>
            </select>
            <button
              type="submit"
              className="border border-[var(--ink)] px-3 py-1 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
            >
              Apply
            </button>
          </form>
        </div>
        <div className="flex gap-2">
          <Link
            href={{ pathname: '/labor/leaderboard/export', query: { period: period.start, format: 'pdf' } } as never}
            className="border border-[var(--rule)] px-3 py-1 smallcaps text-xs hover:bg-[var(--paper-2)]"
          >
            Export PDF
          </Link>
          <Link
            href={{ pathname: '/labor/leaderboard/export', query: { period: period.start, format: 'xlsx' } } as never}
            className="border border-[var(--rule)] px-3 py-1 smallcaps text-xs hover:bg-[var(--paper-2)]"
          >
            Export XLSX
          </Link>
          <Link
            href={'/labor/leaderboard/bonus-rules' as never}
            className="border border-[var(--rule)] px-3 py-1 smallcaps text-xs hover:bg-[var(--paper-2)]"
          >
            Bonus rules
          </Link>
          <Link
            href={'/labor/leaderboard/bonus-runs' as never}
            className="border border-[var(--rule)] px-3 py-1 smallcaps text-xs hover:bg-[var(--paper-2)]"
          >
            Bonus runs
          </Link>
        </div>
      </div>

      {top3.length > 0 ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-6">
          {top3.map((r, i) => {
            const w = workerMap.get(r.workerId as string);
            const opacity = i === 0 ? '1' : i === 1 ? '0.7' : '0.45';
            return (
              <div
                key={r.id as string}
                className="border p-4"
                style={{
                  borderColor: 'var(--rule)',
                  background: `color-mix(in srgb, var(--accent) ${i === 0 ? 18 : i === 1 ? 12 : 7}%, var(--paper))`,
                }}
              >
                <div className="smallcaps text-xs" style={{ opacity }}>
                  Rank {i + 1}
                </div>
                <div className="font-display text-lg mt-1">{w?.fullName ?? '—'}</div>
                {w?.fullNameUr ? <div className="urdu opacity-60 text-sm">{w.fullNameUr}</div> : null}
                <div className="tabular text-2xl mt-2">{Number(r.compositeScore).toFixed(1)}</div>
                <div className="text-xs text-[var(--ink)]/60 mt-1">
                  {r.tasksCompleted as number} tasks · {Number(r.pieceRateUnits).toFixed(0)} units
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            All workers · {period.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">
              No scores yet for this period. Cron computes on the 2nd at 03:00 PKT.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                  <tr>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Rank</th>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Worker</th>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Score</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Days</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Tasks</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Piece units</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Piece Rs.</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Anomalies</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const w = workerMap.get(r.workerId as string);
                    return (
                      <tr key={r.id as string} className="border-t border-[var(--rule)]">
                        <td className="px-3 py-2 tabular">{r.rankInPeriod as number}</td>
                        <td className="px-3 py-2">
                          {w?.fullName ?? r.workerId}
                          {w?.fullNameUr ? <span className="urdu mx-2 opacity-60">{w.fullNameUr}</span> : null}
                        </td>
                        <td className="px-3 py-2 w-64">
                          <ScoreBar score={Number(r.compositeScore)} />
                        </td>
                        <td className="px-3 py-2 text-right tabular">{r.daysPresent as number}</td>
                        <td className="px-3 py-2 text-right tabular">{r.tasksCompleted as number}</td>
                        <td className="px-3 py-2 text-right tabular">{Number(r.pieceRateUnits).toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">
                          <Pkr value={r.pieceRateTotalPkr as string} />
                        </td>
                        <td className="px-3 py-2 text-right tabular">{r.dieselAnomaliesAssociated as number}</td>
                        <td className="px-3 py-2 text-right">
                          {r.bonusEligible ? (
                            <span
                              className="smallcaps text-[0.7rem] px-2 py-0.5 border"
                              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                            >
                              <Pkr value={r.bonusAmountPkr as string} />
                            </span>
                          ) : (
                            <span className="text-[var(--ink)]/40 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-[var(--ink)]/50">
        Computed monthly. Score formula: attendance 30 + tasks 25 + piece volume 25 + piece earnings 15, minus task lateness (2 each), attendance lateness (1 each), diesel anomalies tied to operator (5 each). Clamped 0 to 100.
      </div>
      <div className="text-xs text-[var(--ink)]/50">Period: {fmtDate(period.start)} → {fmtDate(period.end)}</div>
    </div>
  );
}
