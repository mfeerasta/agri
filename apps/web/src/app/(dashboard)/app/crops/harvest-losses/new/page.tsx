import { desc } from 'drizzle-orm';
import { db, harvestRecords, fields } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { eq } from 'drizzle-orm';
import { LossLogForm } from './loss-log-form';

export const dynamic = 'force-dynamic';

export default async function NewHarvestLossPage({
  searchParams,
}: {
  searchParams: Promise<{ harvest?: string }>;
}) {
  const { harvest } = await searchParams;

  const recent = await db
    .select({
      id: harvestRecords.id,
      harvestedOn: harvestRecords.harvestedOn,
      acres: harvestRecords.acresHarvested,
      yieldKg: harvestRecords.grossYieldKg,
    })
    .from(harvestRecords)
    .orderBy(desc(harvestRecords.harvestedOn))
    .limit(50);

  const fieldRows = await db.select({ id: fields.id, code: fields.code }).from(fields);

  return (
    <div>
      <Masthead section="HARVEST LOSS / NEW" />
      <SectionDivider label="Photo evidence required" />
      <div className="p-4 max-w-2xl">
        <LossLogForm
          harvests={recent.map((h) => ({
            id: h.id,
            label: `${new Date(h.harvestedOn).toISOString().slice(0, 10)} · ${Number(h.acres).toFixed(2)} ac · ${Number(h.yieldKg).toFixed(0)} kg`,
          }))}
          fields={fieldRows}
          presetHarvestId={harvest}
        />
      </div>
    </div>
  );
}
