import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { db, consolidationRuns, entities } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr } from '@zameen/ui';
import { finalizeRun } from '../actions';

export const dynamic = 'force-dynamic';

interface StatementLineLike {
  accountCode?: string;
  label: { en: string; ur: string };
  amountRupees: number;
}
interface SectionLike {
  title: { en: string; ur: string };
  lines: StatementLineLike[];
  subtotalRupees: number;
}
interface BS {
  assets: SectionLike;
  liabilities: SectionLike;
  equity: SectionLike;
  totalLiabEqRupees: number;
}
interface IS {
  revenue: SectionLike;
  expenses: SectionLike;
  netIncomeRupees: number;
}
interface CF {
  operating: SectionLike;
  investing: SectionLike;
  financing: SectionLike;
  netChangeRupees: number;
}

function SectionView({ section }: { section: SectionLike }): React.JSX.Element {
  return (
    <div className="space-y-1">
      <div className="smallcaps text-xs text-[var(--zameen-600)]">
        {section.title.en} · {section.title.ur}
      </div>
      {section.lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-[var(--paper-2)] py-1 text-sm">
          <span className="w-14 tabular text-xs text-[var(--zameen-600)]">{l.accountCode ?? ''}</span>
          <span className="flex-1">{l.label.en}</span>
          <span className="tabular text-right">
            <Pkr value={l.amountRupees} />
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-[var(--zameen-700)] pt-1 text-sm font-semibold">
        <span>Subtotal</span>
        <span className="tabular">
          <Pkr value={section.subtotalRupees} />
        </span>
      </div>
    </div>
  );
}

export default async function ConsolidationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = sp.view === 'before' ? 'before' : 'consolidated';

  const [run] = await db.select().from(consolidationRuns).where(eq(consolidationRuns.id, id)).limit(1);
  if (!run) return notFound();

  const childIdsRaw = run.childEntities as unknown;
  const childIds = Array.isArray(childIdsRaw) ? (childIdsRaw as string[]) : [];
  const entityRows =
    childIds.length > 0
      ? await db
          .select()
          .from(entities)
          .where(inArray(entities.id, [run.parentEntityId, ...childIds]))
      : await db.select().from(entities).where(eq(entities.id, run.parentEntityId));
  const entityMap = new Map(entityRows.map((e) => [e.id, e]));

  const bs = run.balanceSheetSnapshot as unknown as BS;
  const is = run.incomeStatementSnapshot as unknown as IS;
  const cf = run.cashFlowSnapshot as unknown as CF;

  const parentName = entityMap.get(run.parentEntityId)?.name ?? '';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section={`Consolidation · ${parentName}`} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="smallcaps rounded-sm bg-[var(--paper-2)] px-2 py-1 text-xs">
          {run.periodStart} to {run.periodEnd}
        </span>
        <span className="smallcaps rounded-sm bg-[var(--paper-2)] px-2 py-1 text-xs">{run.status}</span>
        <div className="ml-auto flex gap-2">
          <Link
            href={`/finance/consolidation/${id}?view=consolidated`}
            className={`smallcaps rounded-sm px-2 py-1 text-xs ${
              view === 'consolidated' ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'
            }`}
          >
            Consolidated
          </Link>
          <Link
            href={`/finance/consolidation/${id}?view=before`}
            className={`smallcaps rounded-sm px-2 py-1 text-xs ${
              view === 'before' ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'
            }`}
          >
            Before eliminations
          </Link>
          <Link
            href={`/finance/consolidation/${id}/export?format=pdf`}
            className="smallcaps rounded-sm bg-[var(--paper-2)] px-2 py-1 text-xs"
          >
            Export PDF
          </Link>
          <Link
            href={`/finance/consolidation/${id}/export?format=xlsx`}
            className="smallcaps rounded-sm bg-[var(--paper-2)] px-2 py-1 text-xs"
          >
            Export XLSX
          </Link>
        </div>
      </div>

      {run.status === 'draft' && (
        <form
          action={async () => {
            'use server';
            await finalizeRun(id);
          }}
        >
          <button className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]">
            Mark final (after director approval)
          </button>
        </form>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {bs && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Balance Sheet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionView section={bs.assets} />
              <SectionView section={bs.liabilities} />
              <SectionView section={bs.equity} />
              <div className="flex items-center justify-between border-t border-[var(--zameen-700)] pt-1 font-semibold">
                <span>Total Liab + Eq</span>
                <span className="tabular">
                  <Pkr value={bs.totalLiabEqRupees} />
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        {is && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income Statement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionView section={is.revenue} />
              <SectionView section={is.expenses} />
              <div className="flex items-center justify-between border-t border-[var(--zameen-700)] pt-1 font-semibold">
                <span>Net Income</span>
                <span className="tabular">
                  <Pkr value={is.netIncomeRupees} />
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        {cf && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cash Flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionView section={cf.operating} />
              <SectionView section={cf.investing} />
              <SectionView section={cf.financing} />
              <div className="flex items-center justify-between border-t border-[var(--zameen-700)] pt-1 font-semibold">
                <span>Net Change in Cash</span>
                <span className="tabular">
                  <Pkr value={cf.netChangeRupees} />
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-entity drilldown</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="smallcaps text-xs text-[var(--zameen-600)]">
                <th className="text-left">Entity</th>
                <th className="text-left">Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{entityMap.get(run.parentEntityId)?.code} {entityMap.get(run.parentEntityId)?.name}</td>
                <td>Parent</td>
              </tr>
              {childIds.map((cid) => (
                <tr key={cid}>
                  <td>
                    {entityMap.get(cid)?.code} {entityMap.get(cid)?.name}
                  </td>
                  <td>Child</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Eliminations applied (
            {Array.isArray(run.eliminationsApplied) ? (run.eliminationsApplied as unknown[]).length : 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(Array.isArray(run.eliminationsApplied) ? (run.eliminationsApplied as Array<{ kind: string | null; description: string; amountPkr: number }>) : []).map(
            (e, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 border-b border-[var(--paper-2)] py-1">
                <span className="smallcaps text-xs">{e.kind ?? 'other'}</span>
                <span className="col-span-2 text-xs">{e.description}</span>
                <span className="tabular text-right text-xs">
                  <Pkr value={Number(e.amountPkr)} />
                </span>
              </div>
            ),
          )}
        </CardContent>
      </Card>
    </div>
  );
}
