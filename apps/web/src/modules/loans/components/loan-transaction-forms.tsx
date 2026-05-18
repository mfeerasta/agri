'use client';
import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { recordLoanDisbursement, recordLoanRepayment } from '@/modules/loans/actions';

export function LoanTransactionForms({ loanId }: { loanId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [dsbAmt, setDsbAmt] = useState('');
  const [dsbOn, setDsbOn] = useState(today);
  const [repayKind, setRepayKind] = useState<'principal_repayment' | 'interest_payment' | 'fee'>('principal_repayment');
  const [repayAmt, setRepayAmt] = useState('');
  const [repayOn, setRepayOn] = useState(today);

  function disburse() {
    setError(null);
    startTransition(async () => {
      const res = await recordLoanDisbursement(loanId, Number(dsbAmt), dsbOn);
      if (!res.ok) setError(res.error);
      else setDsbAmt('');
    });
  }
  function repay() {
    setError(null);
    startTransition(async () => {
      const res = await recordLoanRepayment(loanId, repayKind, Number(repayAmt), repayOn);
      if (!res.ok) setError(res.error);
      else setRepayAmt('');
    });
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card>
        <CardHeader><CardTitle>Record disbursement</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <input value={dsbAmt} onChange={(e) => setDsbAmt(e.target.value)} placeholder="Amount PKR" inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
          <input type="date" value={dsbOn} onChange={(e) => setDsbOn(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
          <button disabled={pending || !dsbAmt} onClick={disburse} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white disabled:opacity-40">Post disbursement</button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Record repayment</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <select value={repayKind} onChange={(e) => setRepayKind(e.target.value as typeof repayKind)} className="border border-[var(--rule)] rounded px-2 py-1 w-full">
            <option value="principal_repayment">Principal repayment</option>
            <option value="interest_payment">Interest payment</option>
            <option value="fee">Fee</option>
          </select>
          <input value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)} placeholder="Amount PKR" inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
          <input type="date" value={repayOn} onChange={(e) => setRepayOn(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
          <button disabled={pending || !repayAmt} onClick={repay} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white disabled:opacity-40">Post repayment</button>
        </CardContent>
      </Card>
      {error && <div className="text-red-600 text-xs md:col-span-2">{error}</div>}
    </div>
  );
}
