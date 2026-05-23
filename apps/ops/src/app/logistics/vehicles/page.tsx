import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, vehicles } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function VehiclesPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const rows = entityId
    ? await db.select().from(vehicles).where(eq(vehicles.entityId, entityId)).orderBy(desc(vehicles.createdAt))
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Fleet" />
      <SectionDivider label={`${rows.length} vehicles`} />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((v) => (
          <Link key={v.id} href={`/logistics/vehicles/${v.id}` as never}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{v.registrationNumber}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="smallcaps text-[var(--zameen-600)]">{v.vehicleType.replace(/_/g, ' ')}</div>
                <div>
                  {v.make} {v.model}
                </div>
                <div className="tabular text-xs">
                  Odometer {Number(v.currentOdometerKm ?? 0).toLocaleString()} km · {v.fuelEconomyKmPerLiter ?? '?'} km/L
                </div>
                <div className="smallcaps text-[0.65rem] text-[var(--zameen-700)]">{v.status}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
