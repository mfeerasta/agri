import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db, entities, entityRelationships, intercompanyTransactions } from '@zameen/db';
import { between, inArray } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { createConsolidationRun } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewConsolidationRun({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const periodStart = sp.from ?? `${new Date().getUTCFullYear()}-07-01`;
  const periodEnd = sp.to ?? today;

  const [parent] = entityId
    ? await db.select().from(entities).where(eq(entities.id, entityId)).limit(1)
    : [];

  const rels = entityId
    ? await db
        .select({
          id: entityRelationships.id,
          childEntityId: entityRelationships.childEntityId,
          ownershipPct: entityRelationships.ownershipPct,
          consolidationMethod: entityRelationships.consolidationMethod,
          effectiveFrom: entityRelationships.effectiveFrom,
          childCode: entities.code,
          childName: entities.name,
        })
        .from(entityRelationships)
        .leftJoin(entities, eq(entities.id, entityRelationships.childEntityId))
        .where(
          and(
            eq(entityRelationships.parentEntityId, entityId),
            lte(entityRelationships.effectiveFrom, periodEnd),
            or(isNull(entityRelationships.effectiveTo), gte(entityRelationships.effectiveTo, periodEnd)),
          ),
        )
    : [];

  const allIds = [entityId, ...rels.map((r) => r.childEntityId)].filter(Boolean);
  const elimCandidates =
    allIds.length >= 2
      ? await db
          .select()
          .from(intercompanyTransactions)
          .where(
            and(
              between(intercompanyTransactions.transactionDate, periodStart, periodEnd),
              inArray(intercompanyTransactions.fromEntityId, allIds as string[]),
              inArray(intercompanyTransactions.toEntityId, allIds as string[]),
            ),
          )
      : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Masthead section="New consolidation run" />
      <form action={createConsolidationRun} className="space-y-4">
        <input type="hidden" name="parentEntityId" value={entityId} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parent + period</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Parent entity</label>
              <div className="rounded-sm bg-[var(--paper-2)] p-2 text-sm">
                {parent?.code} {parent?.name}
              </div>
            </div>
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Period start</label>
              <input
                type="date"
                name="periodStart"
                defaultValue={periodStart}
                className="w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="smallcaps text-xs text-[var(--zameen-600)]">Period end</label>
              <input
                type="date"
                name="periodEnd"
                defaultValue={periodEnd}
                className="w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Child entities to include</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rels.length === 0 && (
              <p className="text-sm text-[var(--zameen-600)]">
                No active child relationships. Add them in{' '}
                <a className="underline" href="/admin/entities">
                  group org chart
                </a>
                .
              </p>
            )}
            {rels.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded-sm bg-[var(--paper-2)] p-2 text-sm">
                <input type="checkbox" name="includeChildEntityIds" value={r.childEntityId} defaultChecked />
                <span className="flex-1">
                  {r.childCode} {r.childName}
                </span>
                <span className="smallcaps text-xs">{r.consolidationMethod}</span>
                <span className="tabular text-xs">{Number(r.ownershipPct).toFixed(2)}%</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elimination candidates ({elimCandidates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {elimCandidates.length === 0 && (
              <p className="text-[var(--zameen-600)]">No intercompany transactions found in period.</p>
            )}
            {elimCandidates.map((e) => (
              <div key={e.id} className="grid grid-cols-5 items-center gap-2 rounded-sm bg-[var(--paper-2)] p-2">
                <span className="text-xs">{e.transactionDate}</span>
                <span className="text-xs">{e.kind ?? 'other'}</span>
                <span className="col-span-2 text-xs">{e.description}</span>
                <span className="tabular text-right text-xs">
                  <Pkr value={Number(e.amountPkr)} />
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <button
          type="submit"
          className="smallcaps rounded-sm bg-[var(--zameen-700)] px-4 py-2 text-[var(--paper)]"
        >
          Run consolidation
        </button>
      </form>
    </div>
  );
}
