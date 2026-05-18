'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { createLoan } from '@/modules/loans/actions';

const LENDER_KINDS = [
  'kissan_card',
  'agri_bank',
  'commercial_bank',
  'arhti_advance',
  'government_subsidy',
  'private_loan',
] as const;

export default function NewLoanPage() {
  const router = useRouter();
  const [entityId, setEntityId] = useState('');
  const [lenderKind, setLenderKind] = useState<(typeof LENDER_KINDS)[number]>('kissan_card');
  const [lenderName, setLenderName] = useState('');
  const [loanNumber, setLoanNumber] = useState('');
  const [principalPkr, setPrincipalPkr] = useState('');
  const [interestRatePct, setInterestRatePct] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [disbursementDate, setDisbursementDate] = useState(today);
  const [maturityDate, setMaturityDate] = useState('');
  const [collateralKind, setCollateralKind] = useState('');
  const [collateralDetails, setCollateralDetails] = useState('');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await createLoan({
      entityId,
      lenderKind,
      lenderName,
      loanNumber: loanNumber || undefined,
      principalPkr: Number(principalPkr),
      interestRatePct: interestRatePct ? Number(interestRatePct) : undefined,
      disbursementDate,
      maturityDate: maturityDate || undefined,
      collateralKind: collateralKind || undefined,
      collateralDetails: collateralDetails || undefined,
      purpose: purpose || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/finance/loans/${res.id}`);
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <Masthead section="NEW CROP LOAN" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Loan details (director approval)</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <label className="smallcaps text-[0.65rem] block">Entity id</label>
            <input value={entityId} onChange={(e) => setEntityId(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Lender kind</label>
              <select value={lenderKind} onChange={(e) => setLenderKind(e.target.value as typeof lenderKind)} className="border border-[var(--rule)] rounded px-2 py-1 w-full">
                {LENDER_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Lender name</label>
              <input value={lenderName} onChange={(e) => setLenderName(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Loan #</label>
              <input value={loanNumber} onChange={(e) => setLoanNumber(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Principal (PKR)</label>
              <input value={principalPkr} onChange={(e) => setPrincipalPkr(e.target.value)} inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Interest %</label>
              <input value={interestRatePct} onChange={(e) => setInterestRatePct(e.target.value)} inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Disbursement date</label>
              <input type="date" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Maturity date</label>
              <input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Collateral kind</label>
              <input value={collateralKind} onChange={(e) => setCollateralKind(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Collateral details</label>
              <input value={collateralDetails} onChange={(e) => setCollateralDetails(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div>
            <label className="smallcaps text-[0.65rem] block">Purpose</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <button disabled={busy} onClick={submit} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy ? 'Submitting…' : 'Submit for approval'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
