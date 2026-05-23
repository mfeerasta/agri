import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import {
  db,
  assets,
  equipmentSharingArrangements,
  equipmentRentals,
} from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  Pkr,
  SectionDivider,
} from '@zameen/ui';
import { BookingForm } from './booking-form';
import { CompleteRentalForm } from './complete-rental-form';

export const dynamic = 'force-dynamic';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function RentalsCalendar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [arr] = await db
    .select()
    .from(equipmentSharingArrangements)
    .where(eq(equipmentSharingArrangements.id, id))
    .limit(1);
  if (!arr) notFound();
  const [asset] = await db.select().from(assets).where(eq(assets.id, arr.assetId)).limit(1);
  const rentals = await db
    .select()
    .from(equipmentRentals)
    .where(eq(equipmentRentals.arrangementId, arr.id))
    .orderBy(asc(equipmentRentals.startAt));

  // Build a simple 14-day calendar starting today.
  const days: Array<{ key: string; label: string; entries: typeof rentals }> = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      key: dayKey(d),
      label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      entries: rentals.filter((r) => dayKey(new Date(r.startAt)) === dayKey(d)),
    });
  }

  const active = rentals.filter((r) => r.status === 'booked' || r.status === 'active');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section={`Rentals: ${asset?.code ?? ''} ${asset?.make ?? ''} ${asset?.model ?? ''}`} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New booking</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingForm arrangementId={arr.id} />
        </CardContent>
      </Card>

      <SectionDivider label="Next 14 days" />
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => (
          <div key={d.key} className="rounded-sm bg-[var(--paper-2)] p-2 text-xs">
            <div className="smallcaps text-[0.6rem] text-[var(--zameen-600)]">{d.label}</div>
            {d.entries.length === 0 && <div className="text-[var(--zameen-600)]">—</div>}
            {d.entries.map((r) => (
              <div key={r.id} className="mt-1 rounded-sm bg-[var(--paper)] p-1">
                <div className="truncate">{r.renterName ?? r.renterMemberId?.slice(0, 8) ?? 'renter'}</div>
                <div className="text-[0.6rem] text-[var(--zameen-700)]">{r.status}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <SectionDivider label="Active and booked" />
      <div className="grid gap-3 md:grid-cols-2">
        {active.length === 0 && <p className="text-xs text-[var(--zameen-600)]">Nothing active.</p>}
        {active.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {r.renterName ?? 'Member'} - {r.status}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-xs">
                {new Date(r.startAt).toLocaleString()} →{' '}
                {r.endAt ? new Date(r.endAt).toLocaleString() : 'open'}
              </div>
              {r.totalChargePkr && (
                <div className="tabular text-xs">
                  <Pkr value={Number(r.totalChargePkr)} />
                </div>
              )}
              <CompleteRentalForm rentalId={r.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
