import { db, cropPlans, fields, cropProfiles } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { computeFieldPnL } from '@zameen/finance';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr, EmptyState } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function FieldPnlPage() {
  const plans = await db
    .select({
      planId: cropPlans.id,
      fieldId: cropPlans.fieldId,
      cropProfileId: cropPlans.cropProfileId,
      seasonLabel: cropPlans.seasonLabel,
    })
    .from(cropPlans)
    .limit(50);

  const pnls = await Promise.all(plans.map((p) => computeFieldPnL(p.planId)));
  const valid = pnls.filter(Boolean) as NonNullable<typeof pnls[number]>[];

  if (valid.length === 0) {
    return (
      <div>
        <Masthead section="FIELD P&L" />
        <SectionDivider />
        <EmptyState title="No P&L data yet" body="Run db:seed and log harvests + cost allocations to populate." />
      </div>
    );
  }

  const totalRevenue = valid.reduce((s, p) => s + p.revenuePkr, 0);
  const totalCost = valid.reduce((s, p) => s + p.totalCostPkr, 0);
  const totalAcres = valid.reduce((s, p) => s + p.acres, 0);

  return (
    <div>
      <Masthead section="FIELD P&L" />
      <SectionDivider />
      <div className="mb-3 flex justify-between smallcaps text-xs text-[var(--ink)]/70">
        <span>{valid.length} plans · {totalAcres.toFixed(2)} acres</span>
        <span>Revenue <Pkr value={totalRevenue} mode="lac_crore" /> · Cost <Pkr value={totalCost} mode="lac_crore" /> · Margin <Pkr value={totalRevenue - totalCost} mode="lac_crore" /></span>
      </div>
      <Card>
        <CardHeader><CardTitle>Per crop plan</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Plan</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Acres</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Yield kg</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Revenue</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Cost</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Margin</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Margin / acre</th>
              </tr>
            </thead>
            <tbody>
              {valid.map((p) => (
                <tr key={p.cropPlanId} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 font-mono text-xs">{p.cropPlanId.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-right tabular">{p.acres.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular">{p.yieldKg.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right"><Pkr value={p.revenuePkr} /></td>
                  <td className="px-3 py-2 text-right"><Pkr value={p.totalCostPkr} /></td>
                  <td className="px-3 py-2 text-right"><Pkr value={p.grossMarginPkr} /></td>
                  <td className="px-3 py-2 text-right"><Pkr value={p.marginPerAcrePkr} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
