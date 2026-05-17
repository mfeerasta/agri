import { redirect } from 'next/navigation';
import { db, storageLocations } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { HarvestForm } from '@/modules/crops/components/harvest-form';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewHarvestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  const locs = await db.select({ id: storageLocations.id, code: storageLocations.code, name: storageLocations.name }).from(storageLocations);

  return (
    <div className="space-y-2">
      <Masthead section="HARVEST / NEW" />
      <SectionDivider />
      <HarvestForm cropPlanId={id} entityId={ctx.entityId} storageLocations={locs} />
    </div>
  );
}
