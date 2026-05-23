import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, cooperativeMembers, groupBuyingPledges, groupBuyingPools } from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  Pkr,
  SectionDivider,
} from '@zameen/ui';
import { PledgeForm } from './pledge-form';
import { ClosePoolButton } from './close-pool-button';

export const dynamic = 'force-dynamic';

export default async function PoolDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pool] = await db.select().from(groupBuyingPools).where(eq(groupBuyingPools.id, id)).limit(1);
  if (!pool) notFound();
  const members = await db
    .select()
    .from(cooperativeMembers)
    .where(eq(cooperativeMembers.cooperativeId, pool.cooperativeId))
    .limit(500);
  const pledges = await db
    .select()
    .from(groupBuyingPledges)
    .where(eq(groupBuyingPledges.poolId, pool.id));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const totalPledged = pledges.reduce((acc, p) => acc + Number(p.pledgedQuantity), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Masthead section={`Pool: ${pool.itemName}`} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Status: {pool.status}</div>
          <div>
            Target: {pool.targetTotalQuantity} {pool.unit} | Pledged: {totalPledged} {pool.unit}
          </div>
          {pool.estimatedPerUnitPkr && (
            <div className="tabular text-xs">
              Estimated value <Pkr value={Number(pool.estimatedPerUnitPkr) * totalPledged} />
            </div>
          )}
          {pool.status === 'open' && <ClosePoolButton poolId={pool.id} />}
        </CardContent>
      </Card>

      {pool.status === 'open' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add pledge</CardTitle>
          </CardHeader>
          <CardContent>
            <PledgeForm
              poolId={pool.id}
              members={members.map((m) => ({ id: m.id, name: m.memberName }))}
              unit={pool.unit}
            />
          </CardContent>
        </Card>
      )}

      <SectionDivider label="Pledges" />
      <div className="grid gap-2">
        {pledges.length === 0 && <p className="text-xs text-[var(--zameen-600)]">No pledges yet.</p>}
        {pledges.map((p) => (
          <div key={p.id} className="flex justify-between rounded-sm bg-[var(--paper-2)] p-2 text-sm">
            <div>{memberMap.get(p.memberId)?.memberName ?? p.memberId.slice(0, 8)}</div>
            <div className="tabular text-xs">
              {p.pledgedQuantity} {pool.unit} | {p.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
