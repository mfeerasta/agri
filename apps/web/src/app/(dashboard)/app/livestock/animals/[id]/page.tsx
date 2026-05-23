import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, EmptyState, StatBlock, Pkr } from '@zameen/ui';
import { db, animals, breedingEvents, milkRecords, healthEvents, feedRecords } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { lifetimeMilkLiters } from '@/modules/livestock/milk-actions';
import { lifetimeFeedCostForAnimal } from '@/modules/livestock/feed-actions';
import { countCalvings, predictNextCalving } from '@/modules/livestock/breeding-actions';
import { currentHealthStatus } from '@/modules/livestock/health-actions';

export default async function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [animal] = await db.select().from(animals).where(eq(animals.id, id)).limit(1);
  if (!animal) return <EmptyState title="Animal not found" />;
  const [breeds, milk, healths, feeds, totalMilkL, totalFeedPkr, calvings, gestationStats, healthStatus] = await Promise.all([
    db.select().from(breedingEvents).where(eq(breedingEvents.animalId, id)).orderBy(desc(breedingEvents.eventDate)),
    db.select().from(milkRecords).where(eq(milkRecords.animalId, id)).orderBy(desc(milkRecords.recordedOn)).limit(60),
    db.select().from(healthEvents).where(eq(healthEvents.animalId, id)).orderBy(desc(healthEvents.eventDate)),
    db.select().from(feedRecords).where(eq(feedRecords.animalId, id)).orderBy(desc(feedRecords.recordedOn)).limit(30),
    lifetimeMilkLiters(id),
    lifetimeFeedCostForAnimal(id),
    countCalvings(id),
    predictNextCalving(id),
    currentHealthStatus(id),
  ]);

  return (
    <div className="space-y-6">
      <Masthead section={`Livestock / Animal ${animal.earTag}`} />
      <SectionDivider />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatBlock label="Lifetime milk (L)" value={Number(totalMilkL.toFixed(1))} />
        <Card>
          <CardHeader><CardTitle className="text-xs">Lifetime feed cost</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold"><Pkr value={totalFeedPkr} /></CardContent>
        </Card>
        <StatBlock label="Calvings" value={calvings} />
        <Card>
          <CardHeader><CardTitle className="text-xs">Predicted next calving</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {gestationStats ? `~${gestationStats.avgGestationDays}d gestation (n=${gestationStats.calvings})` : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs">Current health</CardTitle></CardHeader>
          <CardContent className="text-sm">{healthStatus}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div><dt className="text-slate-500">Species</dt><dd>{animal.species}</dd></div>
          <div><dt className="text-slate-500">Breed</dt><dd>{animal.breed ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Sex</dt><dd>{animal.sex}</dd></div>
          <div><dt className="text-slate-500">DOB</dt><dd>{animal.dob ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Status</dt><dd>{animal.status}</dd></div>
          <div><dt className="text-slate-500">Dam</dt><dd>{animal.damEarTag ?? '—'}</dd></div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between"><CardTitle>Breeding</CardTitle>
            <Link href={`/livestock/animals/${id}/breeding/new` as never} className="text-sm text-emerald-700">+ Log event</Link>
          </CardHeader>
          <CardContent>
            {breeds.length === 0 ? <EmptyState title="No breeding events" /> :
              <ul className="space-y-2 text-sm">{breeds.map((b) => <li key={b.id}>{b.eventDate}: {b.eventType}</li>)}</ul>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between"><CardTitle>Milk records</CardTitle>
            <Link href={`/livestock/animals/${id}/milk/new` as never} className="text-sm text-emerald-700">+ Log milk</Link>
          </CardHeader>
          <CardContent>
            {milk.length === 0 ? <EmptyState title="No milk records" /> :
              <ul className="space-y-2 text-sm">{milk.slice(0, 10).map((m) => <li key={m.id}>{m.recordedOn} ({m.session}): {m.litres} L</li>)}</ul>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between"><CardTitle>Health</CardTitle>
            <Link href={`/livestock/animals/${id}/health/new` as never} className="text-sm text-emerald-700">+ Log event</Link>
          </CardHeader>
          <CardContent>
            {healths.length === 0 ? <EmptyState title="No health events" /> :
              <ul className="space-y-2 text-sm">{healths.map((h) => <li key={h.id}>{h.eventDate}: {h.eventType} — {h.diagnosis ?? ''}</li>)}</ul>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Feed (recent)</CardTitle></CardHeader>
          <CardContent>
            {feeds.length === 0 ? <EmptyState title="No feed records" /> :
              <ul className="space-y-2 text-sm">{feeds.map((f) => <li key={f.id}>{f.recordedOn}: Rs. {f.totalCostPkr}</li>)}</ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
