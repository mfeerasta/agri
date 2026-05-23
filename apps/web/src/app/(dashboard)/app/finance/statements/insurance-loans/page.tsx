import { desc, eq, sum, inArray, and, gte } from 'drizzle-orm';
import {
  db,
  insurancePolicies,
  insuranceClaims,
  weatherIndexTriggers,
  weatherIndexEvaluations,
  cropLoans,
  loanEmiSchedules,
} from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InsuranceLoansSummaryPage() {
  const today = new Date().toISOString().slice(0, 10);

  const openPolicies = await db
    .select()
    .from(insurancePolicies)
    .where(and(eq(insurancePolicies.status, 'active'), gte(insurancePolicies.effectiveTo, today)));

  const policyIds = openPolicies.map((p) => p.id);
  const triggers = policyIds.length
    ? await db.select().from(weatherIndexTriggers).where(inArray(weatherIndexTriggers.policyId, policyIds))
    : [];
  const trigIds = triggers.map((t) => t.id);

  const recentEvals = trigIds.length
    ? await db
        .select()
        .from(weatherIndexEvaluations)
        .where(and(inArray(weatherIndexEvaluations.triggerId, trigIds), eq(weatherIndexEvaluations.isTriggered, true)))
        .orderBy(desc(weatherIndexEvaluations.evaluatedOn))
        .limit(50)
    : [];

  const expectedPayouts = recentEvals.reduce((s, e) => s + Number(e.computedPayoutPkr ?? 0), 0);
  const totalCoverage = openPolicies.reduce((s, p) => s + Number(p.coveragePkr), 0);

  const loans = await db.select().from(cropLoans).where(inArray(cropLoans.status, ['disbursed', 'partially_repaid']));
  const loanIds = loans.map((l) => l.id);
  const emis = loanIds.length
    ? await db.select().from(loanEmiSchedules).where(inArray(loanEmiSchedules.loanId, loanIds))
    : [];

  // group outstanding principal by month bucket
  const buckets = new Map<string, number>();
  for (const e of emis) {
    if (e.status === 'paid' || e.status === 'waived') continue;
    const m = e.dueOn.slice(0, 7);
    buckets.set(m, (buckets.get(m) ?? 0) + Number(e.principalPkr));
  }
  const bucketRows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const totalOutstanding = bucketRows.reduce((s, [, v]) => s + v, 0);
  const overdueCount = emis.filter((e) => e.status === 'overdue').length;

  return (
    <div className="space-y-3">
      <Masthead section="INSURANCE & LOANS SUMMARY" />
      <SectionDivider />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Open policies" value={String(openPolicies.length)} />
        <StatBlock label="Total coverage" value={<Pkr value={totalCoverage} />} />
        <StatBlock label="Active triggers" value={String(triggers.filter((t) => t.isActive).length)} />
        <StatBlock label="Expected payouts (tripped)" value={<Pkr value={expectedPayouts} />} />
        <StatBlock label="Open loans" value={String(loans.length)} />
        <StatBlock label="Principal outstanding" value={<Pkr value={totalOutstanding} />} />
        <StatBlock label="Overdue EMIs" value={String(overdueCount)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Tripped triggers (last 50)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recentEvals.length === 0 ? <EmptyState title="No triggered evaluations" /> : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Trigger</th>
                  <th className="p-3 text-right">Measured</th>
                  <th className="p-3 text-right">Threshold</th>
                  <th className="p-3 text-right">Expected payout</th>
                </tr>
              </thead>
              <tbody>
                {recentEvals.map((e) => {
                  const t = triggers.find((x) => x.id === e.triggerId);
                  return (
                    <tr key={e.id} className="border-b border-[var(--rule)]">
                      <td className="p-3 tabular text-xs">{fmtDate(e.evaluatedOn)}</td>
                      <td className="p-3 smallcaps text-[0.7rem]">{t?.triggerKind}</td>
                      <td className="p-3 text-right tabular">{e.measuredValue}</td>
                      <td className="p-3 text-right tabular">{e.thresholdValue}</td>
                      <td className="p-3 text-right">{e.computedPayoutPkr ? <Pkr value={e.computedPayoutPkr} /> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Loan principal outstanding by month</CardTitle></CardHeader>
        <CardContent className="p-0">
          {bucketRows.length === 0 ? <EmptyState title="No outstanding EMIs" /> : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Month</th>
                  <th className="p-3 text-right">Principal due</th>
                </tr>
              </thead>
              <tbody>
                {bucketRows.map(([m, v]) => (
                  <tr key={m} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular">{m}</td>
                    <td className="p-3 text-right"><Pkr value={v} /></td>
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
