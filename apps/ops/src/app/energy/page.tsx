import Link from 'next/link';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, energyMeters, energyReadings, solarSystems, generatorRuns, assets } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, StatBlock, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function EnergyHome() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) {
    return <EmptyState title="No entity in session" description="Sign in to view energy data." />;
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);

  const [totals] = await db
    .select({
      consumed: sql<number>`coalesce(sum(${energyReadings.consumptionKwh}::numeric), 0)`,
      generated: sql<number>`coalesce(sum(${energyReadings.generationKwh}::numeric), 0)`,
      spendPkr: sql<number>`coalesce(sum(${energyReadings.costPkr}::numeric), 0)`,
    })
    .from(energyReadings)
    .innerJoin(energyMeters, eq(energyReadings.meterId, energyMeters.id))
    .where(and(eq(energyMeters.entityId, entityId), gte(energyReadings.readingDate, sinceIso)));

  const mixRows = await db
    .select({
      meterKind: energyMeters.meterKind,
      kwh: sql<number>`coalesce(sum(coalesce(${energyReadings.consumptionKwh}, ${energyReadings.generationKwh})::numeric), 0)`,
    })
    .from(energyReadings)
    .innerJoin(energyMeters, eq(energyReadings.meterId, energyMeters.id))
    .where(and(eq(energyMeters.entityId, entityId), gte(energyReadings.readingDate, sinceIso)))
    .groupBy(energyMeters.meterKind);

  const [genHours] = await db
    .select({
      hours: sql<number>`coalesce(sum(${generatorRuns.hoursRun}::numeric), 0)`,
      diesel: sql<number>`coalesce(sum(${generatorRuns.dieselConsumedLiters}::numeric), 0)`,
    })
    .from(generatorRuns)
    .innerJoin(assets, eq(generatorRuns.assetId, assets.id))
    .where(and(eq(assets.entityId, entityId), gte(generatorRuns.startedAt, since)));

  const [solarCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(solarSystems)
    .where(eq(solarSystems.entityId, entityId));

  const totalMixKwh = mixRows.reduce((s, r) => s + Number(r.kwh), 0);

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Energy" subtitle="Power, solar, and generator monitoring (last 30 days)" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Consumed kWh" value={Number(totals?.consumed ?? 0).toFixed(0)} />
        <StatBlock label="Solar generated kWh" value={Number(totals?.generated ?? 0).toFixed(0)} />
        <StatBlock label="Generator hours" value={Number(genHours?.hours ?? 0).toFixed(1)} />
        <StatBlock label="Spend" value={<Pkr value={Math.round(Number(totals?.spendPkr ?? 0) * 100)} />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Source mix (last 30d)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {mixRows.length === 0 ? (
              <div className="text-sm text-zinc-500">No readings yet.</div>
            ) : (
              mixRows.map((r) => {
                const pct = totalMixKwh > 0 ? (Number(r.kwh) / totalMixKwh) * 100 : 0;
                return (
                  <div key={r.meterKind} className="flex justify-between text-sm">
                    <span>{r.meterKind}</span>
                    <span>
                      {Number(r.kwh).toFixed(0)} kWh ({pct.toFixed(1)}%)
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <Link className="underline" href="/energy/meters">
                Meters and readings
              </Link>
            </div>
            <div>
              <Link className="underline" href="/energy/solar">
                Solar systems ({solarCount?.n ?? 0})
              </Link>
            </div>
            <div>
              <Link className="underline" href="/energy/generator-runs">
                Generator runs ({Number(genHours?.diesel ?? 0).toFixed(0)} L diesel)
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
