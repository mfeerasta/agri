import { and, desc, eq } from 'drizzle-orm';
import { db, vehicles, workers, dispatchRoutes, produceLots } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { NewTripForm } from './new-trip-form';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const [veh, drv, routes, lots] = entityId
    ? await Promise.all([
        db
          .select({ id: vehicles.id, reg: vehicles.registrationNumber, fuelEcon: vehicles.fuelEconomyKmPerLiter, capacity: vehicles.payloadCapacityKg })
          .from(vehicles)
          .where(and(eq(vehicles.entityId, entityId), eq(vehicles.status, 'available'))),
        db
          .select({ id: workers.id, name: workers.fullName })
          .from(workers)
          .where(and(eq(workers.entityId, entityId), eq(workers.isActive, true)))
          .limit(200),
        db
          .select({ id: dispatchRoutes.id, name: dispatchRoutes.name, km: dispatchRoutes.estimatedDistanceKm, toll: dispatchRoutes.tollCostPkr })
          .from(dispatchRoutes)
          .where(eq(dispatchRoutes.entityId, entityId))
          .orderBy(desc(dispatchRoutes.createdAt)),
        db
          .select({ id: produceLots.id, lotNumber: produceLots.lotNumber, crop: produceLots.cropName, kg: produceLots.netWeightKg })
          .from(produceLots)
          .where(and(eq(produceLots.entityId, entityId), eq(produceLots.status, 'on_hand')))
          .limit(100),
      ])
    : [[], [], [], []];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Masthead section="New dispatch" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTripForm
            vehicles={veh.map((v) => ({
              id: v.id,
              label: v.reg,
              fuelEconomy: v.fuelEcon ? Number(v.fuelEcon) : null,
              capacityKg: v.capacity ? Number(v.capacity) : null,
            }))}
            drivers={drv.map((d) => ({ id: d.id, label: d.name }))}
            routes={routes.map((r) => ({
              id: r.id,
              label: r.name,
              km: r.km ? Number(r.km) : null,
              tollPkr: r.toll ? Number(r.toll) : 0,
            }))}
            produceLots={lots.map((l) => ({
              id: l.id,
              label: `${l.lotNumber} · ${l.crop}`,
              availableKg: Number(l.kg),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
