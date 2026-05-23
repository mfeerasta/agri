import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, insurancePolicies, weatherIndexTriggers, weatherIndexEvaluations } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { TriggerForm, TriggerRowActions } from '@/modules/insurance/components/trigger-form';

export const dynamic = 'force-dynamic';

export default async function PolicyTriggersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [policy] = await db.select().from(insurancePolicies).where(eq(insurancePolicies.id, id)).limit(1);
  if (!policy) return notFound();

  const triggers = await db
    .select()
    .from(weatherIndexTriggers)
    .where(eq(weatherIndexTriggers.policyId, id))
    .orderBy(desc(weatherIndexTriggers.createdAt));

  const trigIds = triggers.map((t) => t.id);
  const recentEvals = trigIds.length === 0
    ? []
    : await db
        .select()
        .from(weatherIndexEvaluations)
        .orderBy(desc(weatherIndexEvaluations.evaluatedOn))
        .limit(50);

  return (
    <div className="space-y-3">
      <Masthead section={`TRIGGERS · ${policy.policyNumber}`} />
      <SectionDivider />

      <Card>
        <CardHeader><CardTitle>Add weather-index trigger</CardTitle></CardHeader>
        <CardContent><TriggerForm policyId={policy.id} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active triggers</CardTitle></CardHeader>
        <CardContent className="p-0">
          {triggers.length === 0 ? <EmptyState title="No triggers configured" /> : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Kind</th>
                  <th className="p-3 text-right">Threshold</th>
                  <th className="p-3 text-right">Window</th>
                  <th className="p-3 text-right">Payout/unit</th>
                  <th className="p-3 text-right">Max payout</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {triggers.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 smallcaps text-[0.7rem]">{t.triggerKind}</td>
                    <td className="p-3 text-right tabular">{t.thresholdValue}</td>
                    <td className="p-3 text-right tabular">{t.measurementWindowDays}d</td>
                    <td className="p-3 text-right">{t.payoutPerUnitPkr ? <Pkr value={t.payoutPerUnitPkr} /> : '—'}</td>
                    <td className="p-3 text-right">{t.maxPayoutPkr ? <Pkr value={t.maxPayoutPkr} /> : '—'}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{t.isActive ? 'active' : 'paused'}</td>
                    <td className="p-3"><TriggerRowActions id={t.id} isActive={t.isActive} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent evaluations</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recentEvals.length === 0 ? <EmptyState title="No evaluations recorded yet" /> : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Measured</th>
                  <th className="p-3 text-right">Threshold</th>
                  <th className="p-3">Tripped</th>
                  <th className="p-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {recentEvals.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular text-xs">{fmtDate(e.evaluatedOn)}</td>
                    <td className="p-3 text-right tabular">{e.measuredValue}</td>
                    <td className="p-3 text-right tabular">{e.thresholdValue}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{e.isTriggered ? 'yes' : 'no'}</td>
                    <td className="p-3 text-right">{e.computedPayoutPkr ? <Pkr value={e.computedPayoutPkr} /> : '—'}</td>
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
