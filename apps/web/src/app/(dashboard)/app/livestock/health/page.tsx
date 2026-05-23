import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { db, animals } from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import { loadHealthEvents, vaccinationsDueWithin } from '@/modules/livestock/health-actions';
import { HealthTimeline } from '@/modules/livestock/components/health-timeline';

export default async function HealthPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');

  const [events, upcoming, animalsList] = await Promise.all([
    loadHealthEvents(ctx.entityId),
    vaccinationsDueWithin(ctx.entityId, 14),
    db.select({ id: animals.id, earTag: animals.earTag, species: animals.species })
      .from(animals)
      .where(and(eq(animals.entityId, ctx.entityId), eq(animals.status, 'active'))),
  ]);

  return (
    <div className="space-y-4">
      <Masthead section="صحت / Livestock Health" />
      <SectionDivider />
      <HealthTimeline events={events} upcoming={upcoming} animalsList={animalsList} />
    </div>
  );
}
