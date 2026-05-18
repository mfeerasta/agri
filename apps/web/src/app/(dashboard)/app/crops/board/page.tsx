import { desc, eq } from 'drizzle-orm';
import { db, cropPlans, cropProfiles, fields } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { SimpleBoardClient, type SimpleBoardItem } from './simple-board-client';

export const dynamic = 'force-dynamic';

const STAGE_GROUPS = [
  { id: 'planned', label: 'Planned', color: '#94a3b8' },
  { id: 'land_prep', label: 'Land Prep', color: '#a78bfa' },
  { id: 'sowing', label: 'Sowing', color: '#60a5fa' },
  { id: 'germination', label: 'Germination', color: '#38bdf8' },
  { id: 'vegetative', label: 'Vegetative', color: '#34d399' },
  { id: 'flowering', label: 'Flowering', color: '#fbbf24' },
  { id: 'fruiting', label: 'Fruiting', color: '#f59e0b' },
  { id: 'maturity', label: 'Maturity', color: '#fb923c' },
  { id: 'harvest', label: 'Harvest', color: '#22c55e' },
  { id: 'post_harvest', label: 'Post-harvest', color: '#10b981' },
];

export default async function CropsBoardPage() {
  const plans = await db
    .select({
      id: cropPlans.id,
      cropName: cropProfiles.name,
      varietyName: cropPlans.varietyName,
      fieldCode: fields.code,
      season: cropPlans.season,
      seasonLabel: cropPlans.seasonLabel,
      plannedAcres: cropPlans.plannedAcres,
      plannedSowingDate: cropPlans.plannedSowingDate,
      plannedHarvestDate: cropPlans.plannedHarvestDate,
      currentStage: cropPlans.currentStage,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId))
    .orderBy(desc(cropPlans.plannedSowingDate));

  const items: SimpleBoardItem[] = plans.map((p) => ({
    id: p.id,
    title: `${p.cropName ?? 'Crop'}${p.varietyName ? ` · ${p.varietyName}` : ''}${p.fieldCode ? ` · ${p.fieldCode}` : ''}`,
    status: p.currentStage,
    startDate: p.plannedSowingDate ? new Date(p.plannedSowingDate) : null,
    endDate: p.plannedHarvestDate ? new Date(p.plannedHarvestDate) : null,
    href: `/crops/${p.id}`,
    meta: {
      field: p.fieldCode ?? '—',
      season: p.seasonLabel,
      acres: p.plannedAcres ? Number(p.plannedAcres).toFixed(2) : '—',
    },
  }));

  return (
    <div>
      <Masthead section="CROPS · BOARD" />
      <SectionDivider label={`${items.length} crop plans`} />
      <div className="p-4">
        <SimpleBoardClient
          items={items}
          groups={STAGE_GROUPS}
          available={['kanban', 'gantt', 'calendar', 'table']}
          metaColumns={[
            { key: 'field', label: 'Field' },
            { key: 'season', label: 'Season' },
            { key: 'acres', label: 'Acres' },
          ]}
          emptyTitle="No crop plans yet"
        />
      </div>
    </div>
  );
}
