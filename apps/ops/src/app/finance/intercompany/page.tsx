import { and, desc, eq, or } from 'drizzle-orm';
import { db, intercompanyTransactions, entities } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { updateIntercompanyStatus } from '../consolidation/actions';

export const dynamic = 'force-dynamic';

type Status = 'pending' | 'reconciled' | 'eliminated' | 'disputed';

const STATUSES: Status[] = ['pending', 'reconciled', 'eliminated', 'disputed'];

export default async function IntercompanyList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;
  const status = (sp.status as Status | undefined) ?? undefined;

  const rows = entityId
    ? await db
        .select()
        .from(intercompanyTransactions)
        .where(
          status
            ? and(
                eq(intercompanyTransactions.eliminationStatus, status),
                or(
                  eq(intercompanyTransactions.fromEntityId, entityId),
                  eq(intercompanyTransactions.toEntityId, entityId),
                ),
              )
            : or(
                eq(intercompanyTransactions.fromEntityId, entityId),
                eq(intercompanyTransactions.toEntityId, entityId),
              ),
        )
        .orderBy(desc(intercompanyTransactions.transactionDate))
        .limit(100)
    : [];

  const allEntityIds = Array.from(new Set(rows.flatMap((r) => [r.fromEntityId, r.toEntityId])));
  const entityRows =
    allEntityIds.length > 0
      ? await db.select().from(entities).where(eq(entities.id, allEntityIds[0]))
      : [];
  const allEntities = allEntityIds.length > 0 ? await db.select().from(entities) : entityRows;
  const entMap = new Map(allEntities.map((e) => [e.id, `${e.code} ${e.name}`]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Intercompany transactions" />
      <div className="flex gap-2">
        <a
          href="/finance/intercompany"
          className={`smallcaps rounded-sm px-2 py-1 text-xs ${
            !status ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'
          }`}
        >
          all
        </a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/finance/intercompany?status=${s}`}
            className={`smallcaps rounded-sm px-2 py-1 text-xs ${
              status === s ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="smallcaps text-xs text-[var(--zameen-600)]">
                <th className="text-left">Date</th>
                <th className="text-left">From</th>
                <th className="text-left">To</th>
                <th className="text-left">Kind</th>
                <th className="text-left">Description</th>
                <th className="text-right">Amount</th>
                <th className="text-left">Status</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--paper-2)]">
                  <td>{r.transactionDate}</td>
                  <td>{entMap.get(r.fromEntityId) ?? r.fromEntityId}</td>
                  <td>{entMap.get(r.toEntityId) ?? r.toEntityId}</td>
                  <td>{r.kind ?? 'other'}</td>
                  <td>{r.description}</td>
                  <td className="tabular text-right">
                    <Pkr value={Number(r.amountPkr)} />
                  </td>
                  <td>
                    <span className="smallcaps text-xs">{r.eliminationStatus}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {STATUSES.filter((s) => s !== r.eliminationStatus).map((s) => (
                        <form
                          key={s}
                          action={async () => {
                            'use server';
                            await updateIntercompanyStatus(r.id, s);
                          }}
                        >
                          <button className="smallcaps rounded-sm bg-[var(--paper-2)] px-2 py-1 text-[10px]">
                            {s}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-[var(--zameen-600)]">
                    No intercompany transactions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
