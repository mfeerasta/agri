import { and, desc, eq } from 'drizzle-orm';
import { db, vehicles, trips } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, SectionDivider } from '@zameen/ui';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return notFound();
  const [v] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.entityId, ctx.entityId)))
    .limit(1);
  if (!v) return notFound();

  const tripRows = await db
    .select()
    .from(trips)
    .where(eq(trips.vehicleId, id))
    .orderBy(desc(trips.createdAt))
    .limit(30);

  // Compute fuel economy from completed trips (last 10).
  const completed = tripRows.filter(
    (t) => Number(t.distanceKm ?? 0) > 0 && Number(t.dieselUsedLiters ?? 0) > 0,
  );
  const economies = completed.slice(0, 10).map((t) => Number(t.distanceKm) / Number(t.dieselUsedLiters));
  const avgEconomy =
    economies.length > 0 ? economies.reduce((a, b) => a + b, 0) / economies.length : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Masthead section={`Vehicle ${v.registrationNumber}`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Type" value={v.vehicleType.replace(/_/g, ' ')} />
        <Stat label="Odometer" value={`${Number(v.currentOdometerKm ?? 0).toLocaleString()} km`} />
        <Stat label="Spec km/L" value={v.fuelEconomyKmPerLiter ?? '—'} />
        <Stat label="Actual avg km/L" value={avgEconomy ? avgEconomy.toFixed(2) : '—'} />
      </div>

      <SectionDivider label="Recent trips" />
      <div className="space-y-2">
        {tripRows.length === 0 && <p className="text-sm text-[var(--zameen-600)]">No trips yet.</p>}
        {tripRows.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {t.tripNumber} <span className="smallcaps text-xs text-[var(--zameen-600)]">{t.status}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div>{t.tripPurpose.replace(/_/g, ' ')}</div>
              <div className="tabular">{Number(t.distanceKm ?? 0).toFixed(1)} km</div>
              <div className="tabular">{Number(t.dieselUsedLiters ?? 0).toFixed(1)} L</div>
              <div className="tabular">
                <Pkr value={Number(t.totalTripCostPkr ?? 0)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-sm bg-[var(--paper-2)] p-3">
      <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">{label}</div>
      <div className="tabular text-base">{value}</div>
    </div>
  );
}
