import { desc, eq, sql, and, gte } from 'drizzle-orm';
import { db, generatorRuns, assets } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, StatBlock, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { GeneratorRunForm } from './generator-run-form';

export const dynamic = 'force-dynamic';

export default async function GeneratorRunsPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) return <EmptyState title="No entity" description="Sign in." />;

  const genAssets = await db
    .select({ id: assets.id, code: assets.code, make: assets.make, model: assets.model })
    .from(assets)
    .where(and(eq(assets.entityId, entityId), eq(assets.category, 'generator')));

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const runs = await db
    .select({
      id: generatorRuns.id,
      assetId: generatorRuns.assetId,
      assetCode: assets.code,
      startedAt: generatorRuns.startedAt,
      endedAt: generatorRuns.endedAt,
      hoursRun: generatorRuns.hoursRun,
      dieselConsumedLiters: generatorRuns.dieselConsumedLiters,
      outputKwhEstimated: generatorRuns.outputKwhEstimated,
      reason: generatorRuns.reason,
      fuelCostPkr: generatorRuns.fuelCostPkr,
    })
    .from(generatorRuns)
    .innerJoin(assets, eq(generatorRuns.assetId, assets.id))
    .where(and(eq(assets.entityId, entityId), gte(generatorRuns.startedAt, since)))
    .orderBy(desc(generatorRuns.startedAt))
    .limit(50);

  const [totals] = await db
    .select({
      hours: sql<number>`coalesce(sum(${generatorRuns.hoursRun}::numeric), 0)`,
      diesel: sql<number>`coalesce(sum(${generatorRuns.dieselConsumedLiters}::numeric), 0)`,
      kwh: sql<number>`coalesce(sum(${generatorRuns.outputKwhEstimated}::numeric), 0)`,
      cost: sql<number>`coalesce(sum(${generatorRuns.fuelCostPkr}::numeric), 0)`,
    })
    .from(generatorRuns)
    .innerJoin(assets, eq(generatorRuns.assetId, assets.id))
    .where(and(eq(assets.entityId, entityId), gte(generatorRuns.startedAt, since)));

  const reasonsMap = new Map<string, number>();
  for (const r of runs) {
    const key = r.reason ?? 'unspecified';
    reasonsMap.set(key, (reasonsMap.get(key) ?? 0) + Number(r.hoursRun ?? 0));
  }

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Generator runs" subtitle="Backup power usage and cost (last 30 days)" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Hours run" value={Number(totals?.hours ?? 0).toFixed(1)} />
        <StatBlock label="Diesel (L)" value={Number(totals?.diesel ?? 0).toFixed(1)} />
        <StatBlock label="kWh produced" value={Number(totals?.kwh ?? 0).toFixed(0)} />
        <StatBlock label="Fuel cost" value={<Pkr value={Math.round(Number(totals?.cost ?? 0) * 100)} />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Log run</CardTitle>
          </CardHeader>
          <CardContent>
            {genAssets.length === 0 ? (
              <div className="text-sm text-zinc-500">No generator assets registered.</div>
            ) : (
              <GeneratorRunForm
                assets={genAssets.map((a) => ({
                  id: a.id,
                  label: `${a.code} ${a.make ?? ''} ${a.model ?? ''}`.trim(),
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hours by reason</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {reasonsMap.size === 0 ? (
              <div className="text-zinc-500">No runs in window.</div>
            ) : (
              Array.from(reasonsMap.entries()).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span>{v.toFixed(1)} h</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-sm text-zinc-500">No runs recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1">Asset</th>
                  <th>Started</th>
                  <th>Hours</th>
                  <th>Diesel L</th>
                  <th>kWh</th>
                  <th>Reason</th>
                  <th>Fuel PKR</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{r.assetCode}</td>
                    <td>{new Date(r.startedAt).toLocaleString()}</td>
                    <td>{r.hoursRun ?? '-'}</td>
                    <td>{r.dieselConsumedLiters ?? '-'}</td>
                    <td>{r.outputKwhEstimated ?? '-'}</td>
                    <td>{r.reason ?? '-'}</td>
                    <td>{r.fuelCostPkr ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
