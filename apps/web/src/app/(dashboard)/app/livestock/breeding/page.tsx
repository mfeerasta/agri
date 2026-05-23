import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { db, animals } from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import { loadBreedingEvents } from '@/modules/livestock/breeding-actions';
import { BreedingBoard } from '@/modules/livestock/components/breeding-board';

export default async function BreedingPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');

  const [events, females, males] = await Promise.all([
    loadBreedingEvents(ctx.entityId),
    db.select({ id: animals.id, earTag: animals.earTag, species: animals.species })
      .from(animals)
      .where(and(eq(animals.entityId, ctx.entityId), eq(animals.sex, 'female'), eq(animals.status, 'active'))),
    db.select({ id: animals.id, earTag: animals.earTag, species: animals.species })
      .from(animals)
      .where(and(eq(animals.entityId, ctx.entityId), eq(animals.sex, 'male'), eq(animals.status, 'active'))),
  ]);

  return (
    <div className="space-y-4">
      <Masthead section="افزائش نسل / Breeding" />
      <SectionDivider />
      <BreedingBoard events={events} females={females} males={males} />
    </div>
  );
}
