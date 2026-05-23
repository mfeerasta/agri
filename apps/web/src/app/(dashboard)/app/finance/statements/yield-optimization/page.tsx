import { asc } from 'drizzle-orm';
import { db, cropVarieties } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { computeVarietyPerformance, computeLossSummary } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function YieldOptimizationReportPage() {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const profiles = await db
    .selectDistinct({ code: cropVarieties.cropProfileCode })
    .from(cropVarieties)
    .orderBy(asc(cropVarieties.cropProfileCode));

  const matrices = await Promise.all(
    profiles.map(async (p) => ({
      crop: p.code,
      m: await computeVarietyPerformance({ entityId: ctx.entityId, cropProfileCode: p.code }),
    })),
  );

  const losses = await computeLossSummary({});
  const totalLossKg = losses.reduce((s, r) => s + r.totalKg, 0);
  const totalLossValue = losses.reduce((s, r) => s + r.totalValuePkr, 0);

  return (
    <div>
      <Masthead section="REPORT / YIELD OPTIMIZATION" />
      <SectionDivider label={`${profiles.length} crops covered`} />
      <div className="p-4 space-y-6">
        <section className="border rounded p-4">
          <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">Season losses</h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-xs text-slate-500">Total kg</div>{totalLossKg.toFixed(0)}</div>
            <div><div className="text-xs text-slate-500">Total PKR</div>{Math.round(totalLossValue).toLocaleString()}</div>
            <div><div className="text-xs text-slate-500">Records</div>{losses.reduce((s, r) => s + r.records, 0)}</div>
          </div>
        </section>

        {matrices.map(({ crop, m }) => (
          <section key={crop} className="border rounded p-4">
            <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">{crop}</h2>
            <div className="text-sm mb-3">
              {m.topPerformer ? (
                <>
                  Winner: <b>{m.topPerformer.varietyName}</b> at {m.topPerformer.weightedScore.toFixed(0)} kg/acre weighted (
                  confidence {m.topPerformer.sampleConfidence}).
                </>
              ) : (
                <span className="text-slate-500">No trials recorded.</span>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-2">Variety</th>
                  <th className="text-right p-2">Weighted kg/acre</th>
                  <th className="text-right p-2">PKR/acre (avg)</th>
                  <th className="text-right p-2">Trials</th>
                  <th className="text-left p-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {m.rows.slice(0, 6).map((r) => (
                  <tr key={r.varietyId} className="border-t">
                    <td className="p-2">{r.varietyName}</td>
                    <td className="p-2 text-right">{r.weightedScore.toFixed(0)}</td>
                    <td className="p-2 text-right">{r.lifetimeAvgNetRevenuePerAcrePkr ? Math.round(r.lifetimeAvgNetRevenuePerAcrePkr).toLocaleString() : '—'}</td>
                    <td className="p-2 text-right">{r.lifetimeTrials}</td>
                    <td className="p-2">{r.sampleConfidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
