import { redirect } from 'next/navigation';
import { db, cropProfiles, fields } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { CropPlanForm } from '@/modules/crops/components/crop-plan-form';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewCropPlanPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  const fieldRows = await db
    .select({ id: fields.id, code: fields.code, name: fields.name, nameUr: fields.nameUr, acres: fields.acres })
    .from(fields)
    .orderBy(fields.code);
  const profiles = await db.select({ id: cropProfiles.id, code: cropProfiles.code, name: cropProfiles.name, season: cropProfiles.season }).from(cropProfiles);

  return (
    <div className="space-y-2">
      <Masthead section="CROP PLAN / NEW" />
      <SectionDivider />
      <CropPlanForm
        entityId={ctx.entityId}
        fieldOptions={fieldRows.map((f) => ({ ...f, acres: Number(f.acres) }))}
        cropProfiles={profiles}
      />
    </div>
  );
}
