import Link from 'next/link';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, bankAccounts, bankTransactions, paymentOrders } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock, Pkr } from '@zameen/ui';
import { computeAccountBalances } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CashDashboardPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6 text-sm">Not authenticated.</div>;

  const balances = await computeAccountBalances(ctx.entityId);
  const accts = await db.select().from(bankAccounts).where(eq(bankAccounts.entityId, ctx.entityId));
  const acctIds = accts.map((a) => a.id);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);

  const recentTxns = acctIds.length
    ? await db
        .select()
        .from(bankTransactions)
        .where(and(inArray(bankTransactions.accountId, acctIds), gte(bankTransactions.transactionDate, sinceIso)))
        .orderBy(desc(bankTransactions.transactionDate))
        .limit(20)
    : [];

  const pendingPayments = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.entityId, ctx.entityId), inArray(paymentOrders.status, ['pending_approval', 'approved', 'queued', 'executing'])))
    .orderBy(desc(paymentOrders.createdAt))
    .limit(15);

  const totalBalance = balances.reduce((s, b) => s + b.currentBalancePkr, 0);
  const pendingTotal = pendingPayments.reduce((s, p) => s + Number(p.amountPkr), 0);
  const availableAfterPending = totalBalance - pendingTotal;
  const acctById = new Map(accts.map((a) => [a.id, a]));

  return (
    <div className="space-y-3">
      <Masthead section="CASH POSITION" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Total cash on hand" value={<Pkr value={totalBalance} />} />
        <StatBlock label="Pending payments" value={<Pkr value={pendingTotal} />} />
        <StatBlock label="Available after pending" value={<Pkr value={availableAfterPending} />} />
        <StatBlock label="Accounts" value={String(balances.length)} />
      </div>
      <div className="flex justify-end gap-2">
        <Link href={'/finance/banking/accounts' as never} className="rounded-md border border-[var(--rule)] px-4 py-2 text-sm">Accounts</Link>
        <Link href={'/finance/banking/reconciliation' as never} className="rounded-md border border-[var(--rule)] px-4 py-2 text-sm">Reconcile</Link>
        <Link href={'/finance/banking/payments/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">New payment</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Per-account balance</CardTitle></CardHeader>
        <CardContent className="p-0">
          {balances.length === 0 ? (
            <EmptyState title="No accounts" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Bank</th>
                  <th className="p-3">Title</th>
                  <th className="p-3 text-right">Credits</th>
                  <th className="p-3 text-right">Debits</th>
                  <th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.accountId} className="border-b border-[var(--rule)]">
                    <td className="p-3 font-semibold">{b.bankName}</td>
                    <td className="p-3">{b.accountTitle}</td>
                    <td className="p-3 text-right text-emerald-700"><Pkr value={b.totalCreditsPkr} /></td>
                    <td className="p-3 text-right text-red-700"><Pkr value={b.totalDebitsPkr} /></td>
                    <td className="p-3 text-right font-semibold"><Pkr value={b.currentBalancePkr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Pending payment orders</CardTitle></CardHeader>
        <CardContent className="p-0">
          {pendingPayments.length === 0 ? (
            <EmptyState title="No pending payments" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Created</th>
                  <th className="p-3">Payee</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">From</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular text-xs">{fmtDate(p.createdAt)}</td>
                    <td className="p-3">{p.payeeName}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{p.paymentKind.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right"><Pkr value={p.amountPkr} /></td>
                    <td className="p-3 text-xs">{acctById.get(p.fromAccountId)?.bankName ?? '—'}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{p.status.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent transactions (30d)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recentTxns.length === 0 ? (
            <EmptyState title="No recent transactions" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Dir</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular text-xs">{fmtDate(t.transactionDate)}</td>
                    <td className="p-3 text-xs">{acctById.get(t.accountId)?.bankName ?? '—'}</td>
                    <td className="p-3 text-xs">{t.description}</td>
                    <td className={`p-3 text-right ${t.direction === 'credit' ? 'text-emerald-700' : 'text-red-700'}`}><Pkr value={t.amountPkr} /></td>
                    <td className="p-3 smallcaps text-[0.7rem]">{t.direction}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{t.status.replace(/_/g, ' ')}</td>
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
