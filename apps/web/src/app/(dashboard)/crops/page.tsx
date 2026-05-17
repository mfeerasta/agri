import Link from 'next/link';
import { db, cropPlans, cropProfiles, fields, harvestRecords } from '@zameen/db';
import { desc, eq, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function CropsListPage() {
  const plans = await db
    .select({
      id: cropPlans.id,
      fieldCode: fields.code,
      cropName: cropProfiles.name,
      cropNameUr: cropProfiles.nameUr,
      varietyName: cropPlans.varietyName,
      season: cropPlans.season,
      seasonLabel: cropPlans.seasonLabel,
      plannedAcres: cropPlans.plannedAcres,
      currentStage: cropPlans.currentStage,
      expectedYieldPerAcre: cropPlans.expectedYieldPerAcre,
    })
    .from(cropPlans)
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId))
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .orderBy(desc(cropPlans.plannedSowingDate));

  const actualByPlan = await db
    .select({ cropPlanId: harvestRecords.cropPlanId, acres: sql<number>`SUM(${harvestRecords.acresHarvested})` })
    .from(harvestRecords)
    .groupBy(harvestRecords.cropPlanId);
  const actualMap = new Map(actualByPlan.map((r) => [r.cropPlanId, Number(r.acres)]));

  const groups = plans.reduce((acc, p) => {
    const key = p.seasonLabel ?? 'Unscheduled';
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(p);
    return acc;
  }, new Map<string, typeof plans>());

  return (
    <div className="space-y-2">
      <Masthead section="CROPS" />
      <SectionDivider />

      <div className="flex justify-end gap-2">
        <Link href={'/crops/board' as never} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]">
          Board
        </Link>
        <Link href={'/crops/plans/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">
          New plan
        </Link>
      </div>

      {plans.length === 0 ? <EmptyState title="No crop plans yet" /> : null}
      {Array.from(groups.entries()).map(([season, list]) => (
        <div key={season}>
          <SectionDivider label={season} />
          <div className="grid gap-4 md:grid-cols-3">
            {list.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle>
                    {p.fieldCode} · {p.cropName}
                    {p.cropNameUr ? <span dir="rtl" className="ml-2 text-sm text-slate-500">{p.cropNameUr}</span> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>Variety: {p.varietyName ?? '—'}</div>
                  <div>
                    Planned: {Number(p.plannedAcres).toFixed(2)} ac · Harvested:{' '}
                    {(actualMap.get(p.id) ?? 0).toFixed(2)} ac
                  </div>
                  <div>
                    <span className="smallcaps text-[0.7rem] text-[var(--ochre)]">Stage</span> {p.currentStage}
                  </div>
                  <div>Expected: {p.expectedYieldPerAcre ?? '—'} per acre</div>
                  <Link href={`/crops/plans/${p.id}` as never} className="text-emerald-700 underline">
                    View
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
