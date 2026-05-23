import Link from 'next/link';
import { asc, eq, sql } from 'drizzle-orm';
import { db, cropVarieties, varietyTrials } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

interface CellAgg {
  yieldPerAcre: number;
  trials: number;
}

function colorFor(yieldKg: number, max: number): string {
  if (yieldKg <= 0 || max <= 0) return 'transparent';
  const ratio = Math.min(1, yieldKg / max);
  const hue = 0 + ratio * 130; // red to green
  return `hsl(${hue}, 70%, 80%)`;
}

export default async function TrialsMatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string }>;
}) {
  const { crop } = await searchParams;

  const profiles = await db
    .selectDistinct({ code: cropVarieties.cropProfileCode })
    .from(cropVarieties)
    .orderBy(asc(cropVarieties.cropProfileCode));

  const cropCode = crop ?? profiles[0]?.code ?? 'wheat';

  const rows = await db
    .select({
      varietyId: varietyTrials.varietyId,
      varietyName: cropVarieties.name,
      season: varietyTrials.season,
      yieldPerAcre: sql<string>`coalesce(avg(${varietyTrials.yieldPerAcreKg}), 0)`,
      trials: sql<number>`count(*)::int`,
    })
    .from(varietyTrials)
    .innerJoin(cropVarieties, eq(cropVarieties.id, varietyTrials.varietyId))
    .where(eq(cropVarieties.cropProfileCode, cropCode))
    .groupBy(varietyTrials.varietyId, cropVarieties.name, varietyTrials.season);

  const seasons = Array.from(new Set(rows.map((r) => r.season))).sort();
  const byVariety = new Map<string, { name: string; cells: Map<string, CellAgg> }>();
  let max = 0;
  for (const r of rows) {
    if (!byVariety.has(r.varietyId)) byVariety.set(r.varietyId, { name: r.varietyName, cells: new Map() });
    const v = byVariety.get(r.varietyId)!;
    const yieldKg = Number(r.yieldPerAcre);
    v.cells.set(r.season, { yieldPerAcre: yieldKg, trials: Number(r.trials) });
    if (yieldKg > max) max = yieldKg;
  }

  return (
    <div>
      <Masthead section="CROPS / VARIETY TRIALS" />
      <SectionDivider label={`${byVariety.size} varieties · ${seasons.length} seasons`} />
      <div className="p-4 space-y-4">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-slate-500">Crop:</span>
          {profiles.map((p) => (
            <Link
              key={p.code}
              href={`/crops/trials?crop=${p.code}` as never}
              className={`px-2 py-1 text-xs border rounded ${p.code === cropCode ? 'bg-[var(--ink)] text-white' : ''}`}
            >
              {p.code}
            </Link>
          ))}
          <span className="ml-auto" />
          <Link href={'/crops/trials/new' as never} className="px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white">
            + Log trial
          </Link>
        </div>

        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-slate-50">Variety</th>
                {seasons.map((s) => (
                  <th key={s} className="text-right p-2">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(byVariety.entries()).map(([vid, v]) => (
                <tr key={vid} className="border-t">
                  <td className="p-2 sticky left-0 bg-white">
                    <Link href={`/crops/varieties/${vid}` as never} className="underline">
                      {v.name}
                    </Link>
                  </td>
                  {seasons.map((s) => {
                    const c = v.cells.get(s);
                    return (
                      <td
                        key={s}
                        className="p-2 text-right"
                        style={{ background: c ? colorFor(c.yieldPerAcre, max) : 'transparent' }}
                      >
                        {c ? (
                          <span title={`${c.trials} trial(s)`}>{c.yieldPerAcre.toFixed(0)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {byVariety.size === 0 ? (
                <tr><td colSpan={seasons.length + 1} className="p-4 text-center text-slate-500">No trials yet for {cropCode}.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Cell color is yield/acre relative to the best variety in the matrix. Tooltip shows trial count.</p>
      </div>
    </div>
  );
}
