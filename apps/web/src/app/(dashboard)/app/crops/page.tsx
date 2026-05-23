import Link from 'next/link';
import { db, cropPlans, cropProfiles, fields, harvestRecords } from '@zameen/db';
import { desc, eq, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function CropsListPage() {
  const locale = await getLocale();
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
    const key = p.seasonLabel ?? t('crops.unscheduled', locale);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(p);
    return acc;
  }, new Map<string, typeof plans>());

  return (
    <div className="space-y-2">
      <Masthead section={t('crops.title', locale)} />
      <SectionDivider />

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={'/crops/board' as never} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)] min-h-[44px] md:min-h-[40px] inline-flex items-center">
          {t('crops.board', locale)}
        </Link>
        <Link href={'/app/crops/feasibility' as never} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)] min-h-[44px] md:min-h-[40px] inline-flex items-center">
          Feasibility planner
        </Link>
        <Link href={'/crops/plans/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">
          {t('crops.new_plan', locale)}
        </Link>
      </div>

      {plans.length === 0 ? <EmptyState title={t('crops.no_plans', locale)} /> : null}
      {Array.from(groups.entries()).map(([season, list]) => (
        <div key={season}>
          <SectionDivider label={season} />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle>
                    {p.fieldCode} · {p.cropName}
                    {p.cropNameUr ? <span dir="rtl" className="ml-2 text-sm text-slate-500">{p.cropNameUr}</span> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>{t('crops.variety', locale)}: {p.varietyName ?? '—'}</div>
                  <div>
                    {t('crops.planned', locale)}: {Number(p.plannedAcres).toFixed(2)} {t('common.acre', locale)} · {t('crops.harvested', locale)}:{' '}
                    {(actualMap.get(p.id) ?? 0).toFixed(2)} {t('common.acre', locale)}
                  </div>
                  <div>
                    <span className="smallcaps text-[0.7rem] text-[var(--ochre)]">{t('crops.stage', locale)}</span> {p.currentStage}
                  </div>
                  <div>{t('crops.expected_per_acre', locale)}: {p.expectedYieldPerAcre ?? '—'}</div>
                  <Link href={`/crops/plans/${p.id}` as never} className="text-emerald-700 underline">
                    {t('action.view', locale)}
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
