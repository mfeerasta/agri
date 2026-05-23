import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db, cooperatives, groupBuyingPools, groupBuyingPledges } from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  Pkr,
  SectionDivider,
} from '@zameen/ui';
import { PoolForm } from './pool-form';

export const dynamic = 'force-dynamic';

export default async function GroupBuyingPage() {
  const coops = await db.select().from(cooperatives).limit(50);
  const pools = await db
    .select()
    .from(groupBuyingPools)
    .orderBy(desc(groupBuyingPools.createdAt))
    .limit(50);
  const pledgeRows = await db
    .select({
      poolId: groupBuyingPledges.poolId,
      pledged: sql<number>`coalesce(sum(${groupBuyingPledges.pledgedQuantity}),0)::numeric`,
      members: sql<number>`count(distinct ${groupBuyingPledges.memberId})::int`,
    })
    .from(groupBuyingPledges)
    .groupBy(groupBuyingPledges.poolId);
  const pledgeMap = new Map(pledgeRows.map((r) => [r.poolId, r]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Group buying" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New buying pool</CardTitle>
        </CardHeader>
        <CardContent>
          <PoolForm cooperatives={coops.map((c) => ({ id: c.id, name: c.name }))} />
        </CardContent>
      </Card>

      <SectionDivider label="Pools" />
      <div className="grid gap-3 md:grid-cols-2">
        {pools.length === 0 && <p className="text-xs text-[var(--zameen-600)]">No pools yet.</p>}
        {pools.map((p) => {
          const agg = pledgeMap.get(p.id);
          const progress =
            agg && Number(p.targetTotalQuantity) > 0
              ? Math.min(100, Math.round((Number(agg.pledged) / Number(p.targetTotalQuantity)) * 100))
              : 0;
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.itemName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">
                  {p.itemKind.replace(/_/g, ' ')} | {p.status}
                </div>
                <div className="text-xs">
                  Target: {p.targetTotalQuantity} {p.unit}
                </div>
                <div className="text-xs">
                  Pledged: {agg?.pledged ?? 0} {p.unit} ({agg?.members ?? 0} members) — {progress}%
                </div>
                {p.estimatedPerUnitPkr && (
                  <div className="tabular text-xs">
                    Est <Pkr value={Number(p.estimatedPerUnitPkr)} /> / {p.unit}
                    {p.estimatedSavingsPct && (
                      <span className="ml-2 text-[var(--zameen-700)]">
                        save {Number(p.estimatedSavingsPct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
                {p.closesOn && <div className="text-xs">Closes {p.closesOn}</div>}
                <Link
                  href={`/cooperative/group-buying/${p.id}` as never}
                  className="smallcaps inline-block rounded-sm bg-[var(--paper-2)] px-2 py-1 text-xs"
                >
                  View pledges
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
