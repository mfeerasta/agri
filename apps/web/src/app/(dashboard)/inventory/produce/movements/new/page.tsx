import { db, produceLots, storageLocations } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { MovementForm } from '@/modules/inventory/components/movement-form';

export const dynamic = 'force-dynamic';

export default async function NewMovementPage() {
  const lots = await db.select({ id: produceLots.id, lotNumber: produceLots.lotNumber, cropName: produceLots.cropName }).from(produceLots);
  const locations = await db.select({ id: storageLocations.id, code: storageLocations.code, name: storageLocations.name }).from(storageLocations);
  return (
    <div className="space-y-2">
      <Masthead section="PRODUCE / MOVE" />
      <SectionDivider />
      <MovementForm lots={lots} locations={locations} />
    </div>
  );
}
