import { asc } from 'drizzle-orm';
import { db, cropVarieties } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { computeVarietyPerformance } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Printable seed order recommendation for the upcoming season.
// Director signs off and supervisor procures via the existing RFQ flow.

export default async function SeedOrderRecommendationPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const { season } = await searchParams;
  const targetSeason = season ?? 'Rabi 2026-27';

  const profiles = await db
    .selectDistinct({ code: cropVarieties.cropProfileCode })
    .from(cropVarieties)
    .orderBy(asc(cropVarieties.cropProfileCode));

  const recs = await Promise.all(
    profiles.map(async (p) => ({
      crop: p.code,
      m: await computeVarietyPerformance({ entityId: ctx.entityId, cropProfileCode: p.code }),
    })),
  );

  return (
    <div>
      <Masthead section={`SEED ORDER / ${targetSeason}`} />
      <SectionDivider label="Director approval required before RFQ" />
      <div className="p-4 max-w-3xl space-y-4 print:p-0">
        <div className="border rounded p-4 print:border-0">
          <h1 className="text-lg font-medium">Seed order recommendation</h1>
          <p className="text-sm text-slate-600">Target season: {targetSeason}</p>
          <p className="text-sm text-slate-600">Generated: {new Date().toISOString().slice(0, 10)}</p>
        </div>

        <table className="w-full text-sm border rounded">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Crop</th>
              <th className="text-left p-2">Recommended variety</th>
              <th className="text-left p-2">Backup</th>
              <th className="text-left p-2">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {recs.map(({ crop, m }) => (
              <tr key={crop} className="border-t">
                <td className="p-2 align-top">{crop}</td>
                <td className="p-2 align-top">{m.recommendations[0]?.varietyName ?? '—'}</td>
                <td className="p-2 align-top">{m.recommendations[1]?.varietyName ?? '—'}</td>
                <td className="p-2 align-top text-xs">{m.recommendations[0]?.rationale ?? 'Insufficient trial data.'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-6 mt-8 text-sm">
          <div>
            <div className="border-t pt-2">Director sign-off</div>
            <div className="text-xs text-slate-500">Name + date</div>
          </div>
          <div>
            <div className="border-t pt-2">Procurement supervisor</div>
            <div className="text-xs text-slate-500">RFQ reference</div>
          </div>
        </div>

        <a href="javascript:window.print()" className="px-3 py-1 text-sm border rounded print:hidden inline-block">
          Print / PDF
        </a>
      </div>
    </div>
  );
}
