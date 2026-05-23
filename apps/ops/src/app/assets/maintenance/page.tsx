import Link from 'next/link';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, assets, maintenancePlans, maintenanceExecutions } from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  Pkr,
  SectionDivider,
  StatBlock,
} from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface PlanRow {
  planId: string;
  assetId: string;
  assetCode: string;
  name: string;
  triggerKind: string;
  estimatedCostPkr: number;
  nextDueAt: Date | null;
  lastExecutedAt: Date | null;
}

function bucketFor(due: Date | null): 'overdue' | 'soon' | 'upcoming' | 'none' {
  if (!due) return 'none';
  const now = Date.now();
  const diffDays = Math.floor((due.getTime() - now) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'soon';
  return 'upcoming';
}

export default async function MaintenancePage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const rows = entityId
    ? ((await db
        .select({
          planId: maintenancePlans.id,
          assetId: maintenancePlans.assetId,
          assetCode: assets.code,
          name: maintenancePlans.name,
          triggerKind: maintenancePlans.triggerKind,
          estimatedCostPkr: maintenancePlans.estimatedCostPkr,
          nextDueAt: maintenancePlans.nextDueAt,
          lastExecutedAt: maintenancePlans.lastExecutedAt,
        })
        .from(maintenancePlans)
        .innerJoin(assets, eq(assets.id, maintenancePlans.assetId))
        .where(and(eq(assets.entityId, entityId), eq(maintenancePlans.isActive, true)))) as unknown as PlanRow[])
    : [];

  const thirty = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [spend30d] = entityId
    ? await db
        .select({ total: sql<string>`coalesce(sum(${maintenanceExecutions.totalCostPkr}), 0)` })
        .from(maintenanceExecutions)
        .innerJoin(assets, eq(assets.id, maintenanceExecutions.assetId))
        .where(and(eq(assets.entityId, entityId), gte(maintenanceExecutions.executedOn, thirty)))
    : [{ total: '0' }];

  // Planned vs unplanned ratio: planned = executions with plan_id, unplanned = without.
  const planned = entityId
    ? await db
        .select({ n: sql<number>`count(*)::int`, hasPlan: sql<boolean>`${maintenanceExecutions.planId} is not null` })
        .from(maintenanceExecutions)
        .innerJoin(assets, eq(assets.id, maintenanceExecutions.assetId))
        .where(and(eq(assets.entityId, entityId), gte(maintenanceExecutions.executedOn, thirty)))
        .groupBy(sql`${maintenanceExecutions.planId} is not null`)
    : [];
  const plannedN = planned.find((p) => p.hasPlan)?.n ?? 0;
  const unplannedN = planned.find((p) => !p.hasPlan)?.n ?? 0;
  const totalN = plannedN + unplannedN;
  const plannedPct = totalN > 0 ? Math.round((plannedN / totalN) * 100) : 0;

  const overdue = rows.filter((r) => bucketFor(r.nextDueAt) === 'overdue');
  const soon = rows.filter((r) => bucketFor(r.nextDueAt) === 'soon');
  const upcoming = rows.filter((r) => bucketFor(r.nextDueAt) === 'upcoming');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Equipment maintenance" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock label="Overdue" value={overdue.length} caption="needs action today" />
        <StatBlock label="Due in 7d" value={soon.length} caption="schedule this week" />
        <StatBlock label="Upcoming" value={upcoming.length} caption="next 30d horizon" />
        <StatBlock
          label="30d spend"
          value={<Pkr value={Number(spend30d?.total ?? 0)} />}
          caption={`${plannedPct}% planned`}
        />
      </div>

      <SectionDivider label="Overdue" />
      <BucketList items={overdue} tone="rose" empty="Nothing overdue. Solid." />

      <SectionDivider label="Due in next 7 days" />
      <BucketList items={soon} tone="amber" empty="No imminent services." />

      <SectionDivider label="Upcoming" />
      <BucketList items={upcoming} tone="emerald" empty="No upcoming services." />
    </div>
  );
}

function BucketList({ items, tone, empty }: { items: PlanRow[]; tone: 'rose' | 'amber' | 'emerald'; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--zameen-600)]">{empty}</p>;
  }
  const ring =
    tone === 'rose'
      ? 'ring-rose-200 bg-rose-50'
      : tone === 'amber'
        ? 'ring-amber-200 bg-amber-50'
        : 'ring-emerald-200 bg-emerald-50';
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((r) => (
        <Card key={r.planId} className={`ring-1 ${ring}`}>
          <CardHeader>
            <CardTitle className="text-base">
              {r.assetCode} — {r.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="smallcaps text-[var(--zameen-600)]">{r.triggerKind.replace(/_/g, ' ')}</div>
            <div>
              Estimated <Pkr value={Number(r.estimatedCostPkr ?? 0)} />
            </div>
            <div>
              {r.nextDueAt
                ? `Due ${new Date(r.nextDueAt).toISOString().slice(0, 10)}`
                : r.lastExecutedAt
                  ? `Last ${new Date(r.lastExecutedAt).toISOString().slice(0, 10)}`
                  : 'No history'}
            </div>
            <Link
              href={`/assets/maintenance/execute/${r.planId}` as never}
              className="smallcaps inline-block pt-1 text-[var(--zameen-700)]"
            >
              Execute service →
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
