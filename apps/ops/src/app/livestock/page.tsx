import Link from 'next/link';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db, animals, milkRecords, healthEvents } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, StatBlock, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function LivestockPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const today = isoDay(new Date());
  const thirtyAgo = isoDay(new Date(Date.now() - 30 * 86400_000));

  const [todayMilk] = entityId
    ? await db
        .select({ litres: sql<number>`coalesce(sum(${milkRecords.litres})::numeric, 0)` })
        .from(milkRecords)
        .innerJoin(animals, eq(animals.id, milkRecords.animalId))
        .where(and(eq(animals.entityId, entityId), eq(milkRecords.recordedOn, today)))
    : [{ litres: 0 }];

  const [avgMilk] = entityId
    ? await db
        .select({ litres: sql<number>`coalesce(sum(${milkRecords.litres})::numeric / 30, 0)` })
        .from(milkRecords)
        .innerJoin(animals, eq(animals.id, milkRecords.animalId))
        .where(
          and(eq(animals.entityId, entityId), gte(milkRecords.recordedOn, thirtyAgo), lte(milkRecords.recordedOn, today)),
        )
    : [{ litres: 0 }];

  const [withdrawal] = entityId
    ? await db
        .select({ n: sql<number>`count(distinct ${healthEvents.animalId})::int` })
        .from(healthEvents)
        .innerJoin(animals, eq(animals.id, healthEvents.animalId))
        .where(and(eq(animals.entityId, entityId), gte(healthEvents.withdrawalUntil, today)))
    : [{ n: 0 }];

  const [sick] = entityId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(animals)
        .where(and(eq(animals.entityId, entityId), eq(animals.status, 'sick')))
    : [{ n: 0 }];

  // Vaccination-due: heuristic — animals with last vaccination event older than 180 days, or no record.
  const vacDue = entityId
    ? await db.execute(sql`
        select count(*)::int as n from zameen.animals a
        where a.entity_id = ${entityId} and a.status = 'active'
          and not exists (
            select 1 from zameen.health_events h
            where h.animal_id = a.id and h.event_type = 'vaccination' and h.event_date > current_date - interval '180 days'
          )
      `)
    : [{ n: 0 } as never];
  const vacDueN = (vacDue as unknown as Array<{ n: number }>)[0]?.n ?? 0;

  const todayN = Number(todayMilk?.litres ?? 0);
  const avgN = Number(avgMilk?.litres ?? 0);
  const deltaPct = avgN > 0 ? Math.round(((todayN - avgN) / avgN) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Masthead section="Livestock" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock
          label="Milk today"
          value={`${todayN.toFixed(1)} L`}
          caption={`30d avg ${avgN.toFixed(1)} L`}
          delta={{ value: deltaPct, label: '%' }}
        />
        <StatBlock label="Vaccination due" value={vacDueN} caption="last vac > 180d" />
        <StatBlock label="In withdrawal" value={withdrawal?.n ?? 0} caption="milk not sellable" />
        <StatBlock label="Sick" value={sick?.n ?? 0} caption="active treatment" />
      </div>

      <SectionDivider label="Quick actions" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-base">Log milk</CardTitle></CardHeader><CardContent><Link href={'/livestock/milk' as never} className="smallcaps text-[var(--zameen-700)]">Open form →</Link></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Log health</CardTitle></CardHeader><CardContent><Link href={'/livestock/health' as never} className="smallcaps text-[var(--zameen-700)]">Open form →</Link></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Log feed</CardTitle></CardHeader><CardContent><Link href={'/livestock/feed' as never} className="smallcaps text-[var(--zameen-700)]">Open form →</Link></CardContent></Card>
      </div>
    </div>
  );
}
