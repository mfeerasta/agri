import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, trips } from '@zameen/db';
import { BigButton, Masthead } from '@zameen/ui';
import { Truck } from 'lucide-react';
import { getFieldSession } from '../../lib/session';

export const dynamic = 'force-dynamic';

export default async function TripList() {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  if (!session.workerId) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="urdu text-sm">آپ ابھی ڈرائیور کے طور پر رجسٹرڈ نہیں ہیں</p>
      </main>
    );
  }
  const rows = await db
    .select()
    .from(trips)
    .where(
      and(
        eq(trips.driverId, session.workerId),
        inArray(trips.status, ['planned', 'dispatched', 'in_transit']),
      ),
    )
    .orderBy(desc(trips.createdAt))
    .limit(20);

  return (
    <main className="mx-auto max-w-md space-y-3 p-4">
      <Masthead section="میرے ٹرپ" />
      {rows.length === 0 && <p className="urdu text-sm text-[var(--zameen-600)]">کوئی ٹرپ نہیں</p>}
      {rows.map((t) => (
        <Link key={t.id} href={`/trip/${t.id}`}>
          <BigButton
            icon={<Truck />}
            label={`${t.tripNumber} · ${t.tripPurpose.replace(/_/g, ' ')}`}
            tone={t.status === 'in_transit' ? 'success' : 'primary'}
          />
        </Link>
      ))}
    </main>
  );
}
