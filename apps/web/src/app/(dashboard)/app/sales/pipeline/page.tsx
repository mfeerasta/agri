import { db, salesOpportunities, buyersCrm } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { PipelineBoardClient } from './pipeline-client';

export const dynamic = 'force-dynamic';

const STAGES = ['lead', 'qualified', 'negotiating', 'contracted', 'delivered', 'lost'] as const;

export default async function PipelinePage() {
  const rows = await db
    .select({
      id: salesOpportunities.id,
      buyerId: salesOpportunities.buyerId,
      buyerName: buyersCrm.name,
      buyerNameFreeform: salesOpportunities.buyerNameFreeform,
      cropCode: salesOpportunities.cropCode,
      estimatedKg: salesOpportunities.estimatedKg,
      targetPricePerKgPkr: salesOpportunities.targetPricePerKgPkr,
      stage: salesOpportunities.stage,
      winProbabilityPct: salesOpportunities.winProbabilityPct,
      expectedCloseDate: salesOpportunities.expectedCloseDate,
    })
    .from(salesOpportunities)
    .leftJoin(buyersCrm, eq(salesOpportunities.buyerId, buyersCrm.id))
    .orderBy(desc(salesOpportunities.createdAt));

  // Forecast: sum estimatedKg * targetPrice * winProbability by crop.
  const forecastByCrop = new Map<string, number>();
  for (const r of rows) {
    if (r.stage === 'lost' || r.stage === 'delivered') continue;
    const kg = Number(r.estimatedKg);
    const price = Number(r.targetPricePerKgPkr ?? 0);
    const prob = (r.winProbabilityPct ?? 0) / 100;
    const weighted = kg * price * prob;
    forecastByCrop.set(r.cropCode, (forecastByCrop.get(r.cropCode) ?? 0) + weighted);
  }
  const forecastTotal = Array.from(forecastByCrop.values()).reduce((a, b) => a + b, 0);

  return (
    <div>
      <Masthead section="PIPELINE" />
      <SectionDivider />
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between">
            <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Weighted forecast (open opps)</div>
            <div className="tabular text-lg">PKR {Math.round(forecastTotal).toLocaleString()}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {Array.from(forecastByCrop.entries()).map(([crop, val]) => (
              <div key={crop} className="flex justify-between border-t border-[var(--rule)] pt-1">
                <span className="smallcaps text-[0.7rem]">{crop}</span>
                <span className="tabular">{Math.round(val).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <PipelineBoardClient
        items={rows.map((r) => ({
          ...r,
          estimatedKg: Number(r.estimatedKg),
          targetPricePerKgPkr: r.targetPricePerKgPkr ? Number(r.targetPricePerKgPkr) : null,
        }))}
        stages={STAGES as unknown as string[]}
      />
    </div>
  );
}
