'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import {
  db,
  vehicles,
  trips,
  dispatchRoutes,
  dispatchLoadPlans,
  mandiDispatches,
} from '@zameen/db';
import { allocateCost } from '@zameen/finance';
import { submitApproval } from '@zameen/approvals';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import {
  vehicleSchema,
  dispatchRouteSchema,
  tripCreateSchema,
  tripCompleteSchema,
  tripGpsPointSchema,
} from '@zameen/shared/validators';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = { ok: true } & T | { ok: false; error: string };

async function nextTripNumber(entityId: string): Promise<string> {
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trips)
    .where(and(eq(trips.entityId, entityId), sql`${trips.tripNumber} like ${'TRP-' + yyyymm + '-%'}`));
  const seq = (row?.n ?? 0) + 1;
  return `TRP-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

export async function createVehicle(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const v = parsed.data;
  const [row] = await db
    .insert(vehicles)
    .values({
      entityId: ctx.entityId,
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      vehicleType: v.vehicleType,
      payloadCapacityKg: v.payloadCapacityKg?.toString(),
      fuelType: v.fuelType,
      fuelEconomyKmPerLiter: v.fuelEconomyKmPerLiter?.toString(),
      currentOdometerKm: v.currentOdometerKm?.toString(),
      assetId: v.assetId,
      driverId: v.driverId,
      isOwned: v.isOwned,
      hireRatePerKmPkr: v.hireRatePerKmPkr,
      notes: v.notes,
    })
    .returning();
  revalidatePath('/logistics/vehicles');
  return { ok: true, id: row!.id };
}

export async function createRoute(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = dispatchRouteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const r = parsed.data;
  const [row] = await db
    .insert(dispatchRoutes)
    .values({
      entityId: ctx.entityId,
      name: r.name,
      originLat: r.originLat.toString(),
      originLng: r.originLng.toString(),
      destinations: r.destinations,
      estimatedDistanceKm: r.estimatedDistanceKm?.toString(),
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      tollCostPkr: r.tollCostPkr,
      savedRoutePolyline: r.savedRoutePolyline,
    })
    .returning();
  revalidatePath('/logistics/routes');
  return { ok: true, id: row!.id };
}

export async function createTrip(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = tripCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const t = parsed.data;

  // Threshold uses asset_purchase as a stand-in if no dedicated category present.
  const expectedTotal =
    Number(t.expectedDieselCostPkr ?? 0) +
    Number(t.expectedTollPkr ?? 0) +
    Number(t.expectedAllowancePkr ?? 0);

  let approvalRequestId: string | undefined;
  const threshold =
    DEFAULT_APPROVAL_THRESHOLDS_PKR.asset_purchase?.supervisor ??
    DEFAULT_APPROVAL_THRESHOLDS_PKR.input_purchase?.supervisor ??
    25000;
  if (expectedTotal >= threshold) {
    const ap = await submitApproval({
      entityId: ctx.entityId,
      approvalType: 'asset_purchase',
      sourceModule: 'transport',
      title: `Trip dispatch — ${t.tripPurpose}`,
      amountPkr: expectedTotal,
      payload: { ...t },
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
    approvalRequestId = ap.id;
  }

  const tripNumber = await nextTripNumber(ctx.entityId);
  const [row] = await db
    .insert(trips)
    .values({
      entityId: ctx.entityId,
      tripNumber,
      vehicleId: t.vehicleId,
      driverId: t.driverId,
      routeId: t.routeId,
      tripPurpose: t.tripPurpose,
      relatedDispatchId: t.relatedDispatchId,
      relatedPurchaseId: t.relatedPurchaseId,
      startOdometerKm: t.startOdometerKm?.toString(),
      cargoDescription: t.cargoDescription,
      cargoWeightKg: t.cargoWeightKg?.toString(),
      dieselUsedLiters: t.expectedDieselLiters?.toString(),
      dieselCostPkr: t.expectedDieselCostPkr,
      tollCostPkr: t.expectedTollPkr,
      driverAllowancePkr: t.expectedAllowancePkr,
      approvalRequestId,
      notes: t.notes,
      status: 'planned',
    })
    .returning();

  if (t.loadPlan.length > 0) {
    await db.insert(dispatchLoadPlans).values(
      t.loadPlan.map((l) => ({
        tripId: row!.id,
        produceLotId: l.produceLotId,
        kgLoaded: l.kgLoaded.toString(),
        loadOrder: l.loadOrder,
        notes: l.notes,
      })),
    );
  }

  if (t.vehicleId) {
    await db.update(vehicles).set({ status: 'dispatched' }).where(eq(vehicles.id, t.vehicleId));
  }

  revalidatePath('/logistics');
  revalidatePath('/logistics/trips/new');
  return { ok: true, id: row!.id };
}

export async function startTrip(tripId: string, startOdometerKm: number): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(trips)
    .set({
      status: 'in_transit',
      departedAt: new Date(),
      startOdometerKm: startOdometerKm.toString(),
      updatedAt: new Date(),
    })
    .where(and(eq(trips.id, tripId), eq(trips.entityId, ctx.entityId)));
  revalidatePath(`/logistics/trips/${tripId}`);
  return { ok: true, id: tripId };
}

export async function appendGpsPoint(tripId: string, point: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = tripGpsPointSchema.safeParse(point);
  if (!parsed.success) return { ok: false, error: 'Invalid GPS point' };
  await db
    .update(trips)
    .set({
      gpsTrack: sql`coalesce(${trips.gpsTrack}, '[]'::jsonb) || ${JSON.stringify([parsed.data])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(trips.id, tripId), eq(trips.entityId, ctx.entityId)));
  return { ok: true, id: tripId };
}

export async function completeTrip(tripId: string, input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = tripCompleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const c = parsed.data;

  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.entityId, ctx.entityId)))
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
      .set({
        status: 'available',
        currentOdometerKm: c.endOdometerKm.toString(),
        driverId: trip.driverId ?? undefined,
      })
      .where(eq(vehicles.id, trip.vehicleId));
  }

  // Cost allocation. Diesel → transport_fuel. Toll/parking/allowance → transport_other.
  const allocatedOn = new Date().toISOString().slice(0, 10);
  const cropPlanFromDispatch = trip.relatedDispatchId
    ? await db
        .select({ cropPlanId: mandiDispatches.produceLotId })
        .from(mandiDispatches)
        .where(eq(mandiDispatches.id, trip.relatedDispatchId))
        .limit(1)
    : [];

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

  void cropPlanFromDispatch;

  revalidatePath('/logistics');
  revalidatePath(`/logistics/trips/${tripId}`);
  return { ok: true, id: tripId };
}

/**
 * When a mandi dispatch is created the caller can invoke this to pre-build a
 * trip from a saved route. Returns the trip id without departing it.
 */
export async function autoCreateTripForMandiDispatch(args: {
  dispatchId: string;
  routeId: string;
  vehicleId?: string;
  driverId?: string;
}): Promise<Result> {
  return createTrip({
    routeId: args.routeId,
    vehicleId: args.vehicleId,
    driverId: args.driverId,
    tripPurpose: 'mandi_delivery',
    relatedDispatchId: args.dispatchId,
    loadPlan: [],
  });
}
