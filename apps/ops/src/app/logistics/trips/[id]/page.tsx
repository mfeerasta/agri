import { and, eq } from 'drizzle-orm';
import { db, trips, vehicles, workers, dispatchLoadPlans, produceLots } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, SectionDivider } from '@zameen/ui';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/session';
import { CompleteTripForm } from './complete-trip-form';

export const dynamic = 'force-dynamic';

export default async function TripDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return notFound();

  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.entityId, ctx.entityId)))
    .limit(1);
  if (!trip) return notFound();

  const [veh] = trip.vehicleId
    ? await db.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId)).limit(1)
    : [null];
  const [drv] = trip.driverId
    ? await db.select().from(workers).where(eq(workers.id, trip.driverId)).limit(1)
    : [null];

  const loadRows = await db
    .select({
      kg: dispatchLoadPlans.kgLoaded,
      lotNumber: produceLots.lotNumber,
      crop: produceLots.cropName,
    })
    .from(dispatchLoadPlans)
    .leftJoin(produceLots, eq(produceLots.id, dispatchLoadPlans.produceLotId))
    .where(eq(dispatchLoadPlans.tripId, id));

  const expectedDiesel = Number(trip.dieselCostPkr ?? 0);
  const expectedToll = Number(trip.tollCostPkr ?? 0);
  const expectedAllowance = Number(trip.driverAllowancePkr ?? 0);
  const expectedTotal = expectedDiesel + expectedToll + expectedAllowance;
  const actualTotal = Number(trip.totalTripCostPkr ?? 0);
  const variance = actualTotal && expectedTotal ? actualTotal - expectedTotal : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Masthead section={`Trip ${trip.tripNumber}`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Status" value={trip.status} />
        <Stat label="Purpose" value={trip.tripPurpose.replace(/_/g, ' ')} />
        <Stat label="Vehicle" value={veh?.registrationNumber ?? '—'} />
        <Stat label="Driver" value={drv?.fullName ?? '—'} />
      </div>

      <SectionDivider label="Cost vs estimate" />
      <Card>
        <CardContent className="grid grid-cols-2 gap-2 p-4 text-sm md:grid-cols-4">
          <div>Expected</div>
          <div className="tabular text-right">
            <Pkr value={expectedTotal} />
          </div>
          <div>Actual</div>
          <div className="tabular text-right">
            <Pkr value={actualTotal} />
          </div>
          <div>Variance</div>
          <div className={`tabular text-right ${variance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            <Pkr value={variance} />
          </div>
          <div>Distance</div>
          <div className="tabular text-right">{Number(trip.distanceKm ?? 0).toFixed(1)} km</div>
        </CardContent>
      </Card>

      <SectionDivider label="Load plan" />
      <div className="space-y-2">
        {loadRows.length === 0 && <p className="text-sm text-[var(--zameen-600)]">No produce loaded.</p>}
        {loadRows.map((r, i) => (
          <Card key={i}>
            <CardContent className="flex justify-between p-3 text-sm">
              <div>
                {r.lotNumber} · {r.crop}
              </div>
              <div className="tabular">{Number(r.kg).toLocaleString()} kg</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {trip.gpsTrack && Array.isArray(trip.gpsTrack) && trip.gpsTrack.length > 0 && (
        <>
          <SectionDivider label={`GPS track (${trip.gpsTrack.length} points)`} />
          <Card>
            <CardContent className="p-3 text-xs">
              <div>
                First: {trip.gpsTrack[0].lat.toFixed(4)}, {trip.gpsTrack[0].lng.toFixed(4)}
              </div>
              <div>
                Last: {trip.gpsTrack[trip.gpsTrack.length - 1].lat.toFixed(4)},{' '}
                {trip.gpsTrack[trip.gpsTrack.length - 1].lng.toFixed(4)}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {trip.proofOfDeliveryUrls.length > 0 && (
        <>
          <SectionDivider label="Proof of delivery" />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {trip.proofOfDeliveryUrls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`POD ${i + 1}`} className="aspect-square w-full rounded-sm object-cover" />
            ))}
          </div>
        </>
      )}

      {trip.status !== 'completed' && trip.status !== 'cancelled' && (
        <>
          <SectionDivider label="Complete trip" />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Closeout</CardTitle>
            </CardHeader>
            <CardContent>
              <CompleteTripForm tripId={trip.id} startKm={Number(trip.startOdometerKm ?? 0)} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-sm bg-[var(--paper-2)] p-3">
      <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">{label}</div>
      <div className="tabular text-sm">{value}</div>
    </div>
  );
}
