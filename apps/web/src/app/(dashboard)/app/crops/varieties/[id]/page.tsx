import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, cropVarieties, varietyTrials, fields } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function VarietyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [v] = await db.select().from(cropVarieties).where(eq(cropVarieties.id, id)).limit(1);
  if (!v) notFound();

  const trials = await db
    .select({
      id: varietyTrials.id,
      season: varietyTrials.season,
      plantedOn: varietyTrials.plantedOn,
      harvestedOn: varietyTrials.harvestedOn,
      areaAcres: varietyTrials.areaAcres,
      yieldPerAcreKg: varietyTrials.yieldPerAcreKg,
      qualityGrade: varietyTrials.qualityGrade,
      disease: varietyTrials.diseasePressureSeverity,
      pest: varietyTrials.pestPressureSeverity,
      netRevenuePkr: varietyTrials.netRevenuePkr,
      fieldCode: fields.code,
    })
    .from(varietyTrials)
    .leftJoin(fields, eq(fields.id, varietyTrials.fieldId))
    .where(eq(varietyTrials.varietyId, id))
    .orderBy(desc(varietyTrials.plantedOn));

  return (
    <div>
      <Masthead section={`VARIETY / ${v.name.toUpperCase()}`} />
      <SectionDivider label={v.cropProfileCode} />
      <div className="p-4 space-y-4">
        <div className="border rounded p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-slate-500">Kind</span><br />{v.varietyKind ?? '—'}</div>
          <div><span className="text-slate-500">Source</span><br />{v.sourceCompany ?? '—'}</div>
          <div><span className="text-slate-500">Released</span><br />{v.releaseYear ?? '—'}</div>
          <div><span className="text-slate-500">Active</span><br />{v.isActive ? 'Yes' : 'No'}</div>
          {v.resistanceTraits && v.resistanceTraits.length ? (
            <div className="col-span-full">
              <span className="text-slate-500">Resistance</span><br />
              {v.resistanceTraits.join(', ')}
            </div>
          ) : null}
          {v.recommendedForZones && v.recommendedForZones.length ? (
            <div className="col-span-full">
              <span className="text-slate-500">Zones</span><br />
              {v.recommendedForZones.join(', ')}
            </div>
          ) : null}
          {v.notes ? <div className="col-span-full"><span className="text-slate-500">Notes</span><br />{v.notes}</div> : null}
        </div>

        <h2 className="text-sm uppercase tracking-wide text-slate-500">Trial history ({trials.length})</h2>
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Season</th>
                <th className="text-left p-2">Field</th>
                <th className="text-right p-2">Acres</th>
                <th className="text-right p-2">Yield kg/acre</th>
                <th className="text-right p-2">Net PKR</th>
                <th className="text-left p-2">Grade</th>
                <th className="text-right p-2">Disease</th>
                <th className="text-right p-2">Pest</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.season}</td>
                  <td className="p-2">{t.fieldCode ?? '—'}</td>
                  <td className="p-2 text-right">{Number(t.areaAcres).toFixed(2)}</td>
                  <td className="p-2 text-right">{t.yieldPerAcreKg ? Number(t.yieldPerAcreKg).toFixed(0) : '—'}</td>
                  <td className="p-2 text-right">{t.netRevenuePkr ? Number(t.netRevenuePkr).toLocaleString() : '—'}</td>
                  <td className="p-2">{t.qualityGrade ?? '—'}</td>
                  <td className="p-2 text-right">{t.disease ?? '—'}</td>
                  <td className="p-2 text-right">{t.pest ?? '—'}</td>
                </tr>
              ))}
              {trials.length === 0 ? (
                <tr><td colSpan={8} className="p-3 text-center text-slate-500">No trials recorded.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
