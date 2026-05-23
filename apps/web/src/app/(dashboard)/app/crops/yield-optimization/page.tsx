import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, cropVarieties } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { computeVarietyPerformance } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function YieldOptimizationPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const { crop } = await searchParams;

  const profiles = await db
    .selectDistinct({ code: cropVarieties.cropProfileCode })
    .from(cropVarieties)
    .orderBy(asc(cropVarieties.cropProfileCode));
  const cropCode = crop ?? profiles[0]?.code ?? 'wheat';

  const matrix = await computeVarietyPerformance({
    entityId: ctx.entityId,
    cropProfileCode: cropCode,
  });

  return (
    <div>
      <Masthead section="CROPS / YIELD OPTIMIZATION" />
      <SectionDivider label={`${cropCode} · ${matrix.rows.length} varieties analysed`} />
      <div className="p-4 space-y-6">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-slate-500">Crop:</span>
          {profiles.map((p) => (
            <Link
              key={p.code}
              href={`/crops/yield-optimization?crop=${p.code}` as never}
              className={`px-2 py-1 text-xs border rounded ${p.code === cropCode ? 'bg-[var(--ink)] text-white' : ''}`}
            >
              {p.code}
            </Link>
          ))}
          <span className="ml-auto" />
          <Link href={'/crops/yield-optimization/seed-order' as never} className="px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white">
            Generate seed order PDF →
          </Link>
        </div>

        <section>
          <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">
            Recommendation for next season
          </h2>
          {matrix.recommendations.length === 0 ? (
            <div className="border rounded p-4 text-slate-500">
              No trial data yet. Log at least 3 trials to get a recommendation.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matrix.recommendations.map((r, i) => (
                <div key={r.varietyId} className="border rounded p-4 bg-emerald-50/40">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">
                    {i === 0 ? 'Primary pick' : 'Backup pick'}
                  </div>
                  <Link href={`/crops/varieties/${r.varietyId}` as never} className="text-lg font-medium underline">
                    {r.varietyName}
                  </Link>
                  <div className="text-sm mt-1">Weighted score: <b>{r.weightedScore.toFixed(0)}</b> kg/acre (recent-3 weighted)</div>
                  <div className="text-sm text-slate-600 mt-1">{r.rationale}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Recent seasons: {r.recentSeasons.join(', ') || 'none'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">
            All varieties (ranked by weighted score)
          </h2>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-2">Variety</th>
                  <th className="text-right p-2">Weighted</th>
                  <th className="text-right p-2">Avg kg/acre</th>
                  <th className="text-right p-2">Avg PKR/acre</th>
                  <th className="text-right p-2">Trials</th>
                  <th className="text-left p-2">Confidence</th>
                  <th className="text-left p-2">Resistance</th>
                  <th className="text-left p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r) => (
                  <tr key={r.varietyId} className="border-t">
                    <td className="p-2">
                      <Link href={`/crops/varieties/${r.varietyId}` as never} className="underline">
                        {r.varietyName}
                      </Link>
                    </td>
                    <td className="p-2 text-right">{r.weightedScore.toFixed(0)}</td>
                    <td className="p-2 text-right">{r.lifetimeAvgYieldPerAcreKg.toFixed(0)}</td>
                    <td className="p-2 text-right">{r.lifetimeAvgNetRevenuePerAcrePkr ? Math.round(r.lifetimeAvgNetRevenuePerAcrePkr).toLocaleString() : '—'}</td>
                    <td className="p-2 text-right">{r.lifetimeTrials}</td>
                    <td className="p-2">{r.sampleConfidence}</td>
                    <td className="p-2">{r.resistanceTraits.join(', ') || '—'}</td>
                    <td className="p-2">{r.sourceCompany ?? '—'}</td>
                  </tr>
                ))}
                {matrix.rows.length === 0 ? (
                  <tr><td colSpan={8} className="p-3 text-center text-slate-500">No trial data.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
