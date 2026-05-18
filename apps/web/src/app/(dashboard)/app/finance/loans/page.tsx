import Link from 'next/link';
import { desc, inArray, sql } from 'drizzle-orm';
import { db, cropLoans, cropLoanTransactions } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LoansListPage() {
  const loans = await db.select().from(cropLoans).orderBy(desc(cropLoans.createdAt));
  const ids = loans.map((l) => l.id);
  const txns = ids.length
    ? await db.select().from(cropLoanTransactions).where(inArray(cropLoanTransactions.loanId, ids))
    : [];

  function outstandingPrincipal(loanId: string): number {
    let disbursed = 0;
    let repaid = 0;
    for (const t of txns) {
      if (t.loanId !== loanId) continue;
      if (t.kind === 'disbursement') disbursed += Number(t.amountPkr);
      if (t.kind === 'principal_repayment') repaid += Number(t.amountPkr);
    }
    return disbursed - repaid;
  }
  function accruedInterestPaid(loanId: string): number {
    return txns
      .filter((t) => t.loanId === loanId && t.kind === 'interest_payment')
      .reduce((s, t) => s + Number(t.amountPkr), 0);
  }

  const totalOutstanding = loans.reduce((s, l) => s + outstandingPrincipal(l.id), 0);
  const totalInterest = loans.reduce((s, l) => s + accruedInterestPaid(l.id), 0);
  const upcoming = loans
    .filter((l) => l.maturityDate && (l.status === 'disbursed' || l.status === 'partially_repaid'))
    .map((l) => l.maturityDate as string)
    .sort()[0];

  return (
    <div className="space-y-3">
      <Masthead section="CROP LOANS" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatBlock label="Outstanding principal" value={<Pkr value={totalOutstanding} />} />
        <StatBlock label="Interest paid" value={<Pkr value={totalInterest} />} />
        <StatBlock label="Next maturity" value={upcoming ? fmtDate(upcoming) : '—'} />
      </div>
      <div className="flex justify-end">
        <Link href={'/finance/loans/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">+ New loan</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Loans</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loans.length === 0 ? (
            <EmptyState title="No loans yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Lender</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3 text-right">Principal</th>
                  <th className="p-3 text-right">Outstanding</th>
                  <th className="p-3">Rate %</th>
                  <th className="p-3">Disbursed</th>
                  <th className="p-3">Maturity</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">
                      <Link href={`/finance/loans/${l.id}` as never} className="font-semibold">{l.lenderName}</Link>
                    </td>
                    <td className="p-3 uppercase smallcaps text-[0.7rem]">{l.lenderKind.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right"><Pkr value={l.principalPkr} /></td>
                    <td className="p-3 text-right"><Pkr value={outstandingPrincipal(l.id)} /></td>
                    <td className="p-3 tabular">{l.interestRatePct ?? '—'}</td>
                    <td className="p-3 tabular text-xs">{fmtDate(l.disbursementDate)}</td>
                    <td className="p-3 tabular text-xs">{l.maturityDate ? fmtDate(l.maturityDate) : '—'}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{l.status}</td>
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
