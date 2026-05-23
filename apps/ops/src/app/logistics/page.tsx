import Link from 'next/link';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, vehicles, trips } from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  Pkr,
  SectionDivider,
  StatBlock,
} from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

const KANBAN: Array<{ key: 'planned' | 'in_transit' | 'delivered'; label: string }> = [
  { key: 'planned', label: 'Planned' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'delivered', label: 'Delivered today' },
];

export default async function LogisticsHome() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const fleetRows = entityId
    ? await db
        .select({ status: vehicles.status, n: sql<number>`count(*)::int` })
        .from(vehicles)
        .where(eq(vehicles.entityId, entityId))
        .groupBy(vehicles.status)
    : [];
  const fleet = Object.fromEntries(fleetRows.map((r) => [r.status, r.n])) as Record<string, number>;

  const today = new Date().toISOString().slice(0, 10);
  const tripRows = entityId
    ? await db
        .select({
          id: trips.id,
          tripNumber: trips.tripNumber,
          status: trips.status,
          purpose: trips.tripPurpose,
          cargo: trips.cargoDescription,
          totalCost: trips.totalTripCostPkr,
          departedAt: trips.departedAt,
        })
        .from(trips)
        .where(and(eq(trips.entityId, entityId), gte(trips.createdAt, new Date(today))))
        .orderBy(desc(trips.createdAt))
        .limit(50)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Transport and dispatch" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock label="Available" value={fleet.available ?? 0} caption="ready to dispatch" />
        <StatBlock label="Dispatched" value={fleet.dispatched ?? 0} caption="on the road" />
        <StatBlock label="In maintenance" value={fleet.maintenance ?? 0} caption="out of service" />
        <StatBlock label="Retired" value={fleet.retired ?? 0} caption="off fleet" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={'/logistics/trips/new' as never} className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]">
          New dispatch
        </Link>
        <Link href={'/logistics/vehicles' as never} className="smallcaps rounded-sm bg-[var(--paper-2)] px-3 py-2">
          Fleet
        </Link>
        <Link href={'/logistics/routes' as never} className="smallcaps rounded-sm bg-[var(--paper-2)] px-3 py-2">
          Routes
        </Link>
      </div>

      <SectionDivider label="Today's trips" />
      <div className="grid gap-4 md:grid-cols-3">
        {KANBAN.map((col) => {
          const items = tripRows.filter((t) => t.status === col.key);
          return (
            <Card key={col.key}>
              <CardHeader>
                <CardTitle className="text-base">
                  {col.label} <span className="text-[var(--zameen-600)]">({items.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 && <p className="text-xs text-[var(--zameen-600)]">Nothing here.</p>}
                {items.map((t) => (
                  <Link
                    key={t.id}
                    href={`/logistics/trips/${t.id}` as never}
                    className="block rounded-sm bg-[var(--paper-2)] p-2 text-sm"
                  >
                    <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">{t.tripNumber}</div>
                    <div className="text-sm">{t.cargo ?? t.purpose.replace(/_/g, ' ')}</div>
                    {t.totalCost && (
                      <div className="tabular text-xs text-[var(--zameen-700)]">
                        <Pkr value={Number(t.totalCost)} />
                      </div>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
