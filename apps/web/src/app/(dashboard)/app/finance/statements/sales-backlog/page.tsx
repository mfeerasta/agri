import { db, salesOpportunities, forwardContracts, produceLots } from '@zameen/db';
import { inArray, sql } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

interface CropAgg {
  cropCode: string;
  openOpps: number;
  pipelineKg: number;
  weightedKg: number;
  weightedPkr: number;
  committedKg: number;
  deliveredKg: number;
  outstandingKg: number;
  inventoryKg: number;
}

export default async function SalesBacklogReport() {
  const [opps, contracts, lots] = await Promise.all([
    db.select().from(salesOpportunities)
      .where(inArray(salesOpportunities.stage, ['lead', 'qualified', 'negotiating', 'contracted'])),
    db.select().from(forwardContracts)
      .where(inArray(forwardContracts.status, ['open', 'partially_delivered'])),
    db.select({
      cropCode: sql<string>`COALESCE(${produceLots.cropName}::text, '')`.as('crop_code'),
      kg: sql<string>`SUM(${produceLots.netWeightKg})`.as('kg'),
    }).from(produceLots).where(sql`${produceLots.status} = 'on_hand'`).groupBy(produceLots.cropName)
      .catch(() => [] as Array<{ cropCode: string; kg: string }>),
  ]);

  const agg = new Map<string, CropAgg>();
  const get = (code: string): CropAgg => {
    let row = agg.get(code);
    if (!row) {
      row = { cropCode: code, openOpps: 0, pipelineKg: 0, weightedKg: 0, weightedPkr: 0, committedKg: 0, deliveredKg: 0, outstandingKg: 0, inventoryKg: 0 };
      agg.set(code, row);
    }
    return row;
  };

  for (const o of opps) {
    const row = get(o.cropCode);
    const kg = Number(o.estimatedKg);
    const price = Number(o.targetPricePerKgPkr ?? 0);
    const prob = (o.winProbabilityPct ?? 0) / 100;
    row.openOpps += 1;
    row.pipelineKg += kg;
    row.weightedKg += kg * prob;
    row.weightedPkr += kg * price * prob;
  }
  for (const c of contracts) {
    const row = get(c.cropCode);
    const committed = Number(c.committedKg);
    const delivered = Number(c.deliveredKg);
    row.committedKg += committed;
    row.deliveredKg += delivered;
    row.outstandingKg += Math.max(0, committed - delivered);
  }
  for (const l of lots) {
    if (!l.cropCode) continue;
    const row = get(l.cropCode);
    row.inventoryKg += Number(l.kg);
  }

  const cropAggs = Array.from(agg.values()).sort((a, b) => b.weightedPkr - a.weightedPkr);
  const totals = cropAggs.reduce(
    (a, r) => ({
      openOpps: a.openOpps + r.openOpps,
      pipelineKg: a.pipelineKg + r.pipelineKg,
      weightedKg: a.weightedKg + r.weightedKg,
      weightedPkr: a.weightedPkr + r.weightedPkr,
      committedKg: a.committedKg + r.committedKg,
      outstandingKg: a.outstandingKg + r.outstandingKg,
      inventoryKg: a.inventoryKg + r.inventoryKg,
    }),
    { openOpps: 0, pipelineKg: 0, weightedKg: 0, weightedPkr: 0, committedKg: 0, outstandingKg: 0, inventoryKg: 0 },
  );

  return (
    <div className="space-y-3">
      <Masthead section="SALES BACKLOG" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Open pipeline + committed deliveries vs inventory</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
              <th className="text-left px-3 py-2 smallcaps">Crop</th>
              <th className="text-right px-3 py-2 smallcaps">Open opps</th>
              <th className="text-right px-3 py-2 smallcaps">Pipeline kg</th>
              <th className="text-right px-3 py-2 smallcaps">Weighted kg</th>
              <th className="text-right px-3 py-2 smallcaps">Weighted PKR</th>
              <th className="text-right px-3 py-2 smallcaps">Committed kg</th>
              <th className="text-right px-3 py-2 smallcaps">Outstanding kg</th>
              <th className="text-right px-3 py-2 smallcaps">Inventory kg</th>
              <th className="text-right px-3 py-2 smallcaps">Coverage</th>
            </tr></thead>
            <tbody>
              {cropAggs.map((r) => {
                const need = r.outstandingKg + r.weightedKg;
                const coverage = need > 0 ? (r.inventoryKg / need) * 100 : 0;
                const short = coverage < 80;
                return (
                  <tr key={r.cropCode} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{r.cropCode}</td>
                    <td className="px-3 py-2 text-right tabular">{r.openOpps}</td>
                    <td className="px-3 py-2 text-right tabular">{Math.round(r.pipelineKg).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular">{Math.round(r.weightedKg).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular">{Math.round(r.weightedPkr).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular">{Math.round(r.committedKg).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular">{Math.round(r.outstandingKg).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular">{Math.round(r.inventoryKg).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular" style={{ color: short ? '#c0392b' : '#2c7a3e' }}>{coverage.toFixed(0)}%</td>
                  </tr>
                );
              })}
              {cropAggs.length === 0 ? (
                <tr><td colSpan={9} className="p-6 text-center text-[var(--ink)]/50">No open opportunities or contracts.</td></tr>
              ) : null}
            </tbody>
            <tfoot className="border-t-2 border-[var(--ink)] font-medium">
              <tr>
                <td className="px-3 py-2 smallcaps">Total</td>
                <td className="px-3 py-2 text-right tabular">{totals.openOpps}</td>
                <td className="px-3 py-2 text-right tabular">{Math.round(totals.pipelineKg).toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular">{Math.round(totals.weightedKg).toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular">{Math.round(totals.weightedPkr).toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular">{Math.round(totals.committedKg).toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular">{Math.round(totals.outstandingKg).toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular">{Math.round(totals.inventoryKg).toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
