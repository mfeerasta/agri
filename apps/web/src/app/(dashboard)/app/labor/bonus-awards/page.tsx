import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listBonusRuleSets, listBonusAwards } from '@/modules/labor/bonus-actions';
import { BonusAwardsClient } from '@/modules/labor/components/bonus-awards-client';

export const dynamic = 'force-dynamic';

export default async function BonusAwardsPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Unauthorized</div>;
  const ruleSets = await listBonusRuleSets(ctx.entityId);
  const recent = await listBonusAwards({ entityId: ctx.entityId });

  return (
    <div>
      <Masthead section="BONUS AWARDS" />
      <SectionDivider />
      {ruleSets.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-[var(--ink)]/50">
            Define a bonus rule set first under <a className="underline" href="/labor/bonus-rules">/labor/bonus-rules</a>.
          </CardContent>
        </Card>
      ) : (
        <BonusAwardsClient
          entityId={ctx.entityId}
          ruleSets={ruleSets.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive }))}
          recent={recent.map((a) => ({
            id: a.id,
            workerCode: a.workerCode,
            workerName: a.workerName,
            periodStart: a.periodStart,
            periodEnd: a.periodEnd,
            totalBonusPkr: Number(a.totalBonusPkr),
            approvalRequestId: a.approvalRequestId,
            paidInPayrollRunId: a.paidInPayrollRunId,
          }))}
        />
      )}
    </div>
  );
}
