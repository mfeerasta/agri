import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { db, trips } from '@zameen/db';
import { Masthead } from '@zameen/ui';
import { getFieldSession } from '../../../lib/session';
import { TripDriverPanel } from './driver-panel';

export const dynamic = 'force-dynamic';

export default async function FieldTripDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getFieldSession();
  if (!session) redirect('/login');
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.entityId, session.entityId)))
    .limit(1);
  if (!trip) return notFound();

  return (
    <main className="mx-auto max-w-md space-y-3 p-4">
      <Masthead section={`ٹرپ ${trip.tripNumber}`} />
      <TripDriverPanel
        tripId={trip.id}
        status={trip.status}
        startKm={trip.startOdometerKm ? Number(trip.startOdometerKm) : null}
      />
    </main>
  );
}
