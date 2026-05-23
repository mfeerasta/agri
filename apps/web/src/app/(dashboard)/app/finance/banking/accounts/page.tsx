import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock, Pkr } from '@zameen/ui';
import { computeAccountBalances } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function BankAccountsPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6 text-sm">Not authenticated.</div>;
  const balances = await computeAccountBalances(ctx.entityId);
  const totalBalance = balances.reduce((s, b) => s + b.currentBalancePkr, 0);
  const totalCredits = balances.reduce((s, b) => s + b.totalCreditsPkr, 0);
  const totalDebits = balances.reduce((s, b) => s + b.totalDebitsPkr, 0);

  return (
    <div className="space-y-3">
      <Masthead section="BANK ACCOUNTS" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Accounts" value={String(balances.length)} />
        <StatBlock label="Total balance" value={<Pkr value={totalBalance} />} />
        <StatBlock label="Lifetime credits" value={<Pkr value={totalCredits} />} />
        <StatBlock label="Lifetime debits" value={<Pkr value={totalDebits} />} />
      </div>
      <div className="flex justify-end gap-2">
        <Link href={'/finance/banking/dashboard' as never} className="rounded-md border border-[var(--rule)] px-4 py-2 text-sm">Cash dashboard</Link>
        <Link href={'/finance/banking/statements/import' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">Import statement</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
        <CardContent className="p-0">
          {balances.length === 0 ? (
            <EmptyState title="No bank accounts on file" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Bank</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Number</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.accountId} className="border-b border-[var(--rule)]">
                    <td className="p-3 font-semibold">{b.bankName}</td>
                    <td className="p-3">{b.accountTitle}</td>
                    <td className="p-3 tabular text-xs">{b.accountNumber}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{b.accountKind.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right"><Pkr value={b.currentBalancePkr} /></td>
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
