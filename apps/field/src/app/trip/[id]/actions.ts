'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { db, trips, vehicles } from '@zameen/db';
import { allocateCost } from '@zameen/finance';
import { tripCompleteSchema, tripGpsPointSchema } from '@zameen/shared/validators';
import { getFieldSession } from '../../../lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function startTrip(tripId: string, startOdometerKm: number): Promise<Result> {
  const s = await getFieldSession();
  if (!s) return { ok: false, error: 'Not authenticated' };
  await db
    .update(trips)
    .set({
      status: 'in_transit',
      departedAt: new Date(),
      startOdometerKm: startOdometerKm.toString(),
      updatedAt: new Date(),
    })
    .where(and(eq(trips.id, tripId), eq(trips.entityId, s.entityId)));
  revalidatePath(`/trip/${tripId}`);
  return { ok: true, id: tripId };
}

export async function appendGpsPoint(tripId: string, point: unknown): Promise<Result> {
  const s = await getFieldSession();
  if (!s) return { ok: false, error: 'Not authenticated' };
  const parsed = tripGpsPointSchema.safeParse(point);
  if (!parsed.success) return { ok: false, error: 'Invalid GPS point' };
  await db
    .update(trips)
    .set({
      gpsTrack: sql`coalesce(${trips.gpsTrack}, '[]'::jsonb) || ${JSON.stringify([parsed.data])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(trips.id, tripId), eq(trips.entityId, s.entityId)));
  return { ok: true, id: tripId };
}

export async function completeTrip(tripId: string, input: unknown): Promise<Result> {
  const s = await getFieldSession();
  if (!s) return { ok: false, error: 'Not authenticated' };
  const parsed = tripCompleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const c = parsed.data;

  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.entityId, s.entityId)))
    .limit(1);
  if (!trip) return { ok: false, error: 'Trip not found' };

  const startKm = Number(trip.startOdometerKm ?? 0);
  const distance = c.distanceKm ?? Math.max(0, c.endOdometerKm - startKm);
  const totalCost =
    Number(c.dieselCostPkr) +
    Number(c.tollCostPkr ?? 0) +
    Number(c.parkingCostPkr ?? 0) +
    Number(c.driverAllowancePkr ?? 0);

  await db
    .update(trips)
    .set({
      status: 'completed',
      arrivedAt: new Date(),
      completedAt: new Date(),
      endOdometerKm: c.endOdometerKm.toString(),
      distanceKm: distance.toString(),
      dieselUsedLiters: c.dieselUsedLiters.toString(),
      dieselCostPkr: c.dieselCostPkr,
      tollCostPkr: c.tollCostPkr,
      parkingCostPkr: c.parkingCostPkr,
      driverAllowancePkr: c.driverAllowancePkr,
      totalTripCostPkr: totalCost.toString(),
      proofOfDeliveryUrls: c.proofOfDeliveryUrls,
      notes: c.notes,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  if (trip.vehicleId) {
    await db
      .update(vehicles)
      .set({ status: 'available', currentOdometerKm: c.endOdometerKm.toString() })
      .where(eq(vehicles.id, trip.vehicleId));
  }

  const allocatedOn = new Date().toISOString().slice(0, 10);
  if (Number(c.dieselCostPkr) > 0) {
    await allocateCost({
      entityId: trip.entityId,
      sourceModule: 'other',
      sourceRecordId: trip.id,
      costPool: 'transport_fuel',
      amountPkr: Number(c.dieselCostPkr),
      allocatedOn,
      allocationKey: `trip-${trip.id}-fuel`,
      notes: `Trip ${trip.tripNumber} diesel`.slice(0, 256),
    });
  }
  const other =
    Number(c.tollCostPkr ?? 0) + Number(c.parkingCostPkr ?? 0) + Number(c.driverAllowancePkr ?? 0);
  if (other > 0) {
    await allocateCost({
      entityId: trip.entityId,
      sourceModule: 'other',
      sourceRecordId: trip.id,
      costPool: 'transport_other',
      amountPkr: other,
      allocatedOn,
      allocationKey: `trip-${trip.id}-other`,
      notes: `Trip ${trip.tripNumber} toll/allowance`.slice(0, 256),
    });
  }

  revalidatePath(`/trip/${tripId}`);
  revalidatePath('/trip');
  return { ok: true, id: tripId };
}
