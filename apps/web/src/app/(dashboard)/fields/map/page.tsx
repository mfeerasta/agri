import { db, fields, blocks, farms, cropPlans, cropProfiles, soilTests } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { FieldsMapView, type FieldMapField } from '@/modules/fields/components/fields-map-view';

export const dynamic = 'force-dynamic';

const CROP_PALETTE: Record<string, string> = {
  wheat: '#E5B25D',
  maize: '#F2B84B',
  cotton: '#F4F1EA',
  rice: '#7FB069',
  berseem: '#2D6A4F',
  sugarcane: '#74C69D',
  fodder: '#52B788',
};

function colorFor(cropName: string | null): string {
  if (!cropName) return '#4B5563';
  const key = cropName.toLowerCase();
  for (const [k, v] of Object.entries(CROP_PALETTE)) {
    if (key.includes(k)) return v;
  }
  return '#22D3EE';
}

export default async function FieldsMapPage() {
  const rows = await db
    .select({
      id: fields.id,
      code: fields.code,
      name: fields.name,
      acres: fields.acres,
      geometry: fields.geometry,
      blockId: fields.blockId,
      blockCode: blocks.code,
      farmName: farms.name,
    })
    .from(fields)
    .leftJoin(blocks, eq(blocks.id, fields.blockId))
    .leftJoin(farms, eq(farms.id, blocks.farmId))
    .orderBy(fields.code);

  const activePlans = await db
    .select({
      fieldId: cropPlans.fieldId,
      stage: cropPlans.currentStage,
      cropName: cropProfiles.name,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId));
  const planByField = new Map(activePlans.map((p) => [p.fieldId, p]));

  const latestSoil = await db
    .select({ fieldId: soilTests.fieldId, ph: soilTests.ph })
    .from(soilTests)
    .orderBy(desc(soilTests.testedOn));
  const phByField = new Map<string, string | null>();
  for (const r of latestSoil) if (!phByField.has(r.fieldId)) phByField.set(r.fieldId, r.ph);

  const mapFields: FieldMapField[] = rows
    .filter((r) => r.geometry)
    .map((r) => {
      const plan = planByField.get(r.id);
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        acres: Number(r.acres),
        geometry: r.geometry as FieldMapField['geometry'],
        cropName: plan?.cropName ?? null,
        cropColor: colorFor(plan?.cropName ?? null),
        stage: plan?.stage ?? null,
        soilPh: phByField.get(r.id) ?? null,
      };
    });

  return (
    <div className="space-y-2">
      <Masthead section="FIELDS / MAP" />
      <SectionDivider />
      <FieldsMapView fields={mapFields} />
    </div>
  );
}
