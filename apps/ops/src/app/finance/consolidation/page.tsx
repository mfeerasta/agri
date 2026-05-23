import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, consolidationRuns, entities } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Status = 'draft' | 'final' | 'superseded';

interface RunListItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: Status;
  consolidatedAt: Date;
  parentName: string;
  netIncome: number;
  totalAssets: number;
  eliminationsCount: number;
}

export default async function ConsolidationList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;
  const statusFilter = (sp.status as Status | undefined) ?? undefined;

  const runs = entityId
    ? await db
        .select({
          id: consolidationRuns.id,
          periodStart: consolidationRuns.periodStart,
          periodEnd: consolidationRuns.periodEnd,
          status: consolidationRuns.status,
          consolidatedAt: consolidationRuns.consolidatedAt,
          incomeStatementSnapshot: consolidationRuns.incomeStatementSnapshot,
          balanceSheetSnapshot: consolidationRuns.balanceSheetSnapshot,
          eliminationsApplied: consolidationRuns.eliminationsApplied,
          parentName: entities.name,
        })
        .from(consolidationRuns)
        .leftJoin(entities, eq(entities.id, consolidationRuns.parentEntityId))
        .where(
          statusFilter
            ? and(eq(consolidationRuns.parentEntityId, entityId), eq(consolidationRuns.status, statusFilter))
            : eq(consolidationRuns.parentEntityId, entityId),
        )
        .orderBy(desc(consolidationRuns.consolidatedAt))
        .limit(50)
    : [];

  const items: RunListItem[] = runs.map((r) => {
    const is = (r.incomeStatementSnapshot as { netIncomeRupees?: number } | null) ?? null;
    const bs = (r.balanceSheetSnapshot as { assets?: { subtotalRupees?: number } } | null) ?? null;
    const elims = (r.eliminationsApplied as unknown[]) ?? [];
    return {
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      status: r.status as Status,
      consolidatedAt: r.consolidatedAt,
      parentName: r.parentName ?? '',
      netIncome: is?.netIncomeRupees ?? 0,
      totalAssets: bs?.assets?.subtotalRupees ?? 0,
      eliminationsCount: Array.isArray(elims) ? elims.length : 0,
    };
  });

  const statuses: Array<Status | 'all'> = ['all', 'draft', 'final', 'superseded'];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Consolidation reports" />
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/finance/consolidation/new"
          className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]"
        >
          New consolidation run
        </Link>
        <Link href="/finance/intercompany" className="smallcaps rounded-sm bg-[var(--paper-2)] px-3 py-2">
          Intercompany transactions
        </Link>
        <Link href="/admin/entities" className="smallcaps rounded-sm bg-[var(--paper-2)] px-3 py-2">
          Group org chart
        </Link>
        <div className="ml-auto flex gap-1">
          {statuses.map((s) => (
            <Link
              key={s}
              href={s === 'all' ? '/finance/consolidation' : `/finance/consolidation?status=${s}`}
              className={`smallcaps rounded-sm px-2 py-1 text-xs ${
                (statusFilter ?? 'all') === s ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {items.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-[var(--zameen-600)]">No consolidation runs yet.</p>
            </CardContent>
          </Card>
        )}
        {items.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base">
                <Link href={`/finance/consolidation/${r.id}`}>
                  {r.parentName} · {r.periodStart} to {r.periodEnd}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <div className="smallcaps text-xs text-[var(--zameen-600)]">Status</div>
                <div>{r.status}</div>
              </div>
              <div>
                <div className="smallcaps text-xs text-[var(--zameen-600)]">Total assets</div>
                <div className="tabular">
                  <Pkr value={r.totalAssets} />
                </div>
              </div>
              <div>
                <div className="smallcaps text-xs text-[var(--zameen-600)]">Net income</div>
                <div className="tabular">
                  <Pkr value={r.netIncome} />
                </div>
              </div>
              <div>
                <div className="smallcaps text-xs text-[var(--zameen-600)]">Eliminations</div>
                <div className="tabular">{r.eliminationsCount}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
