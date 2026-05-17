import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, fields, cropPlans, cropProfiles, harvestRecords, soilTests } from '@zameen/db';
import { and, desc, eq } from 'drizzle-orm';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartCard,
  EmptyState,
  FieldMap,
  Masthead,
  SectionDivider,
  StatBlock,
} from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [field] = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
  if (!field) notFound();

  const plans = await db
    .select({
      id: cropPlans.id,
      cropName: cropProfiles.name,
      season: cropPlans.season,
      seasonLabel: cropPlans.seasonLabel,
      plannedAcres: cropPlans.plannedAcres,
      currentStage: cropPlans.currentStage,
      plannedSowingDate: cropPlans.plannedSowingDate,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(eq(cropPlans.fieldId, id))
    .orderBy(desc(cropPlans.plannedSowingDate));

  const harvests = await db
    .select({
      id: harvestRecords.id,
      harvestedOn: harvestRecords.harvestedOn,
      acresHarvested: harvestRecords.acresHarvested,
      grossYieldKg: harvestRecords.grossYieldKg,
      cropPlanId: harvestRecords.cropPlanId,
    })
    .from(harvestRecords)
    .innerJoin(cropPlans, and(eq(cropPlans.id, harvestRecords.cropPlanId), eq(cropPlans.fieldId, id)))
    .orderBy(desc(harvestRecords.harvestedOn));

  const tests = await db
    .select()
    .from(soilTests)
    .where(eq(soilTests.fieldId, id))
    .orderBy(desc(soilTests.testedOn));

  const currentPlan = plans[0];
  const latestPh = tests[0]?.ph ?? null;
  const yieldSeries = harvests
    .slice()
    .reverse()
    .map((h) => ({
      label: fmtDate(h.harvestedOn),
      yieldKgAcre: Number(h.grossYieldKg) / Math.max(Number(h.acresHarvested), 0.01),
    }));

  const polygon = field.geometry
    ? [{ id: field.id, code: field.code, geometry: field.geometry as never }]
    : [];

  return (
    <div className="space-y-2">
      <Masthead section={`FIELD / ${field.code}`} />
      <SectionDivider />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {field.code} {field.name ? `· ${field.name}` : ''}
          </h1>
          {field.nameUr ? <div dir="rtl" className="text-sm text-slate-500">{field.nameUr}</div> : null}
        </div>
        <div className="flex gap-2">
          <Link href={`/fields/${id}/edit` as never} className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white">
            Edit
          </Link>
          <Link
            href={`/fields/${id}/soil-tests/new` as never}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white"
          >
            New soil test
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label="Acres" value={Number(field.acres).toFixed(2)} />
        <StatBlock label="Tenure" value={field.tenure.replace('_', ' ')} />
        <StatBlock label="Current crop" value={currentPlan?.cropName ?? '—'} caption={currentPlan?.seasonLabel ?? ''} />
        <StatBlock label="Last soil pH" value={latestPh ?? '—'} />
      </div>

      <SectionDivider label="Map" />
      {polygon.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <FieldMap fields={polygon} />
          </CardContent>
        </Card>
      ) : null}

      <SectionDivider label="History" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Crop plans</CardTitle></CardHeader>
          <CardContent className="p-0">
            {plans.length === 0 ? (
              <EmptyState title="No plans yet" />
            ) : (
              <ul>
                {plans.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between border-b border-[var(--rule)] px-5 py-3">
                    <Link href={`/crops/plans/${p.id}` as never} className="font-body">
                      {p.cropName} · {p.seasonLabel}
                    </Link>
                    <span className="tabular text-xs text-slate-500">{p.currentStage}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {yieldSeries.length > 0 ? (
          <ChartCard title="Yield (kg per acre)" data={yieldSeries} xKey="label" yKey="yieldKgAcre" unit="kg / acre" />
        ) : (
          <Card>
            <CardHeader><CardTitle>Yield</CardTitle></CardHeader>
            <CardContent><EmptyState title="No harvests recorded" /></CardContent>
          </Card>
        )}
      </div>

      <SectionDivider label="Soil tests" />
      <Card>
        <CardContent className="p-0">
          {tests.length === 0 ? (
            <EmptyState title="No soil tests" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Tested on</th>
                  <th className="p-3">Lab</th>
                  <th className="p-3">pH</th>
                  <th className="p-3">N</th>
                  <th className="p-3">P</th>
                  <th className="p-3">K</th>
                  <th className="p-3">OM %</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">{fmtDate(t.testedOn)}</td>
                    <td className="p-3">{t.laboratory ?? ''}</td>
                    <td className="p-3 tabular">{t.ph ?? ''}</td>
                    <td className="p-3 tabular">{t.nitrogenPpm ?? ''}</td>
                    <td className="p-3 tabular">{t.phosphorusPpm ?? ''}</td>
                    <td className="p-3 tabular">{t.potassiumPpm ?? ''}</td>
                    <td className="p-3 tabular">{t.organicMatterPct ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
