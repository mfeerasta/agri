import { eq } from 'drizzle-orm';
import { db, assets, maintenancePlans } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr } from '@zameen/ui';
import { ExecuteForm } from './execute-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ planId: string }>;
}

export default async function ExecuteMaintenancePage({ params }: PageProps) {
  const { planId } = await params;
  const [plan] = await db.select().from(maintenancePlans).where(eq(maintenancePlans.id, planId)).limit(1);
  if (!plan) return <div className="p-6">Maintenance plan not found.</div>;
  const [asset] = await db.select().from(assets).where(eq(assets.id, plan.assetId)).limit(1);
  if (!asset) return <div className="p-6">Asset missing for plan.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Masthead section={`Service: ${asset.code} — ${plan.name}`} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {plan.taskTemplate.map((s, i) => (
              <li key={i}>
                <span className="smallcaps mr-2 text-[var(--zameen-600)]">{s.required ? 'must' : 'opt'}</span>
                {s.step}
                {s.stepUr ? <span dir="rtl" className="ml-2 text-[var(--zameen-700)]">{s.stepUr}</span> : null}
              </li>
            ))}
          </ul>
          <div className="smallcaps mt-3 text-[var(--zameen-600)]">
            Estimated <Pkr value={Number(plan.estimatedCostPkr ?? 0)} /> · downtime {plan.estimatedDowntimeHours ?? '—'}h
          </div>
        </CardContent>
      </Card>

      <ExecuteForm
        planId={plan.id}
        assetId={plan.assetId}
        partsRequired={plan.partsRequired}
      />
    </div>
  );
}
