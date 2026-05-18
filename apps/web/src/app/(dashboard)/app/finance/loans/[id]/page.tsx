import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, cropLoans, cropLoanTransactions } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { LoanTransactionForms } from '@/modules/loans/components/loan-transaction-forms';
import { buildAmortization } from '@/modules/loans/amortization';

export const dynamic = 'force-dynamic';

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [loan] = await db.select().from(cropLoans).where(eq(cropLoans.id, id)).limit(1);
  if (!loan) return notFound();
  const txns = await db.select().from(cropLoanTransactions).where(eq(cropLoanTransactions.loanId, id)).orderBy(desc(cropLoanTransactions.occurredOn));

  const disbursed = txns.filter((t) => t.kind === 'disbursement').reduce((s, t) => s + Number(t.amountPkr), 0);
  const repaid = txns.filter((t) => t.kind === 'principal_repayment').reduce((s, t) => s + Number(t.amountPkr), 0);
  const interestPaid = txns.filter((t) => t.kind === 'interest_payment').reduce((s, t) => s + Number(t.amountPkr), 0);
  const outstanding = disbursed - repaid;

  const schedule = loan.interestRatePct && loan.maturityDate
    ? buildAmortization({
        principalPkr: Number(loan.principalPkr),
        ratePct: Number(loan.interestRatePct),
        disbursementDate: loan.disbursementDate,
        maturityDate: loan.maturityDate,
      })
    : null;

  return (
    <div className="space-y-3">
      <Masthead section={`LOAN ${loan.lenderName}`} />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Loan</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="smallcaps text-[0.65rem]">Lender kind</div><div className="uppercase">{loan.lenderKind.replace(/_/g, ' ')}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Loan #</div><div>{loan.loanNumber ?? '—'}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Principal</div><Pkr value={loan.principalPkr} /></div>
          <div><div className="smallcaps text-[0.65rem]">Rate</div><div className="tabular">{loan.interestRatePct ?? '—'}%</div></div>
          <div><div className="smallcaps text-[0.65rem]">Disbursed</div><div className="tabular text-xs">{fmtDate(loan.disbursementDate)}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Maturity</div><div className="tabular text-xs">{loan.maturityDate ? fmtDate(loan.maturityDate) : '—'}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Outstanding</div><Pkr value={outstanding} /></div>
          <div><div className="smallcaps text-[0.65rem]">Interest paid</div><Pkr value={interestPaid} /></div>
          <div><div className="smallcaps text-[0.65rem]">Collateral</div><div>{loan.collateralKind ?? '—'}</div></div>
          <div className="col-span-2 md:col-span-4"><div className="smallcaps text-[0.65rem]">Purpose</div><div>{loan.purpose ?? '—'}</div></div>
        </CardContent>
      </Card>

      <LoanTransactionForms loanId={loan.id} />

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {txns.length === 0 ? <EmptyState title="No transactions yet" /> : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Date</th><th className="p-3">Kind</th><th className="p-3 text-right">Amount</th><th className="p-3">Notes</th></tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular text-xs">{fmtDate(t.occurredOn)}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{t.kind.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right"><Pkr value={t.amountPkr} /></td>
                    <td className="p-3 text-xs">{t.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {schedule && (
        <Card>
          <CardHeader><CardTitle>Amortization schedule</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">#</th><th className="p-3">Due</th><th className="p-3 text-right">Principal</th><th className="p-3 text-right">Interest</th><th className="p-3 text-right">Balance</th></tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.period} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular">{r.period}</td>
                    <td className="p-3 tabular text-xs">{fmtDate(r.dueOn)}</td>
                    <td className="p-3 text-right"><Pkr value={r.principalPkr} /></td>
                    <td className="p-3 text-right"><Pkr value={r.interestPkr} /></td>
                    <td className="p-3 text-right"><Pkr value={r.balancePkr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
