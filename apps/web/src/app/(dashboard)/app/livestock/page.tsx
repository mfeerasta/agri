import Link from 'next/link';
import { Masthead, SectionDivider, StatBlock, ChartCard, Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { db, animals, milkRecords, healthEvents } from '@zameen/db';
import { sql, gte, and, eq } from 'drizzle-orm';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export default async function LivestockHome() {
  const locale = await getLocale();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const animalsBySpecies = await db
    .select({ species: animals.species, count: sql<number>`count(*)::int` })
    .from(animals)
    .where(eq(animals.status, 'active'))
    .groupBy(animals.species);

  const milkToday = await db
    .select({ total: sql<string>`coalesce(sum(${milkRecords.litres}), 0)` })
    .from(milkRecords)
    .where(eq(milkRecords.recordedOn, today));

  const lactating = await db
    .select({ count: sql<number>`count(distinct ${milkRecords.animalId})::int` })
    .from(milkRecords)
    .where(gte(milkRecords.recordedOn, thirtyDaysAgo));

  const milkTrend = await db
    .select({
      day: sql<string>`to_char(${milkRecords.recordedOn}, 'YYYY-MM-DD')`,
      litres: sql<string>`coalesce(sum(${milkRecords.litres}), 0)`,
    })
    .from(milkRecords)
    .where(gte(milkRecords.recordedOn, thirtyDaysAgo))
    .groupBy(sql`to_char(${milkRecords.recordedOn}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${milkRecords.recordedOn}, 'YYYY-MM-DD')`);

  const counts: Record<string, number> = {};
  for (const r of animalsBySpecies) counts[r.species] = Number(r.count);

  return (
    <div className="space-y-6">
      <Masthead section={t('livestock.title', locale)} />
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={'/livestock/animals/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">{t('action.new', locale)}</Link>
        <Link href={'/livestock/feed/new' as never} className="rounded-md bg-emerald-600 px-4 py-2 text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">{t('livestock.log_feed', locale)}</Link>
      </div>
      <SectionDivider />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Link href={'/livestock/milk-log' as never} className="rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--surface-2)]">
          <div className="text-lg font-semibold">دودھ لاگ</div>
          <div className="text-sm text-[var(--muted)]">Milk Log</div>
        </Link>
        <Link href={'/livestock/feed-log' as never} className="rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--surface-2)]">
          <div className="text-lg font-semibold">فیڈ لاگ</div>
          <div className="text-sm text-[var(--muted)]">Feed Log</div>
        </Link>
        <Link href={'/livestock/breeding' as never} className="rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--surface-2)]">
          <div className="text-lg font-semibold">افزائش نسل</div>
          <div className="text-sm text-[var(--muted)]">Breeding</div>
        </Link>
        <Link href={'/livestock/health' as never} className="rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--surface-2)]">
          <div className="text-lg font-semibold">صحت</div>
          <div className="text-sm text-[var(--muted)]">Health</div>
        </Link>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock label="Cattle" value={counts.cattle ?? 0} />
        <StatBlock label="Buffalo" value={counts.buffalo ?? 0} />
        <StatBlock label="Goat" value={counts.goat ?? 0} />
        <StatBlock label={`${t('livestock.log_milk', locale)} (30d)`} value={Number(lactating[0]?.count ?? 0)} />
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Milk today (L)</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{Number(milkToday[0]?.total ?? 0).toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Pending vaccinations</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">0</CardContent>
        </Card>
      </div>
      <ChartCard
        title="30-day milk trend (litres)"
        xKey="day"
        yKey="litres"
        unit="L"
        data={milkTrend.map((r) => ({ day: r.day, litres: Number(r.litres) }))}
      />
    </div>
  );
}
