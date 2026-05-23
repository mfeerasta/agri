import Link from 'next/link';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, bankAccounts, bankTransactions, bankStatements } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { ReconcileQueue } from '@/modules/finance/components/reconcile-queue';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6 text-sm">Not authenticated.</div>;

  const accts = await db.select().from(bankAccounts).where(eq(bankAccounts.entityId, ctx.entityId));
  const acctIds = accts.map((a) => a.id);
  if (acctIds.length === 0) {
    return (
      <div className="space-y-3">
        <Masthead section="RECONCILIATION" />
        <SectionDivider />
        <EmptyState title="No bank accounts" />
      </div>
    );
  }

  const txns = await db
    .select()
    .from(bankTransactions)
    .where(and(inArray(bankTransactions.accountId, acctIds), inArray(bankTransactions.status, ['unreconciled', 'flagged'])))
    .orderBy(desc(bankTransactions.transactionDate))
    .limit(200);

  const stmts = await db
    .select()
    .from(bankStatements)
    .where(inArray(bankStatements.accountId, acctIds))
    .orderBy(desc(bankStatements.importedAt))
    .limit(8);

  const acctById = new Map(accts.map((a) => [a.id, a]));
  const unreconciled = txns.filter((t) => t.status === 'unreconciled').length;
  const flagged = txns.filter((t) => t.status === 'flagged').length;

  return (
    <div className="space-y-3">
      <Masthead section="RECONCILIATION QUEUE" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatBlock label="Unreconciled" value={String(unreconciled)} />
        <StatBlock label="Flagged for review" value={String(flagged)} />
        <StatBlock label="Statements" value={String(stmts.length)} />
      </div>
      <Card>
        <CardHeader><CardTitle>Recent statements</CardTitle></CardHeader>
        <CardContent className="p-0">
          {stmts.length === 0 ? (
            <EmptyState title="No statements imported yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Account</th>
                  <th className="p-3">Period</th>
                  <th className="p-3 text-right">Credits</th>
                  <th className="p-3 text-right">Debits</th>
                  <th className="p-3">Count</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {stmts.map((s) => {
                  const a = acctById.get(s.accountId);
                  return (
                    <tr key={s.id} className="border-b border-[var(--rule)]">
                      <td className="p-3 font-semibold">{a?.bankName ?? '—'}</td>
                      <td className="p-3 tabular text-xs">{fmtDate(s.periodStart)} → {fmtDate(s.periodEnd)}</td>
                      <td className="p-3 text-right"><Pkr value={s.totalCreditsPkr} /></td>
                      <td className="p-3 text-right"><Pkr value={s.totalDebitsPkr} /></td>
                      <td className="p-3 tabular">{s.transactionCount}</td>
                      <td className="p-3 smallcaps text-[0.7rem]">{s.reconciliationStatus.replace(/_/g, ' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Match queue ({txns.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {txns.length === 0 ? (
            <EmptyState title="Everything matched" />
          ) : (
            <ReconcileQueue
              rows={txns.map((t) => ({
                id: t.id,
                date: t.transactionDate,
                description: t.description,
                counterparty: t.counterparty,
                amountPkr: Number(t.amountPkr),
                direction: t.direction as 'debit' | 'credit',
                status: t.status,
                accountLabel: acctById.get(t.accountId)?.bankName ?? '',
              }))}
            />
          )}
        </CardContent>
      </Card>
      <div>
        <Link href={'/finance/banking/statements/import' as never} className="text-sm underline">Import another statement</Link>
      </div>
    </div>
  );
}
