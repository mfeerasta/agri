'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { createPolicy } from '@/modules/insurance/actions';

const KINDS = ['crop', 'livestock', 'asset', 'liability', 'health'] as const;

export default function NewPolicyPage() {
  const router = useRouter();
  const [entityId, setEntityId] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [insurerName, setInsurerName] = useState('');
  const [policyKind, setPolicyKind] = useState<(typeof KINDS)[number]>('crop');
  const [coveragePkr, setCoveragePkr] = useState('');
  const [premiumPkr, setPremiumPkr] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await createPolicy({
      entityId,
      policyNumber,
      insurerName,
      policyKind,
      coveragePkr: Number(coveragePkr),
      premiumPkr: Number(premiumPkr),
      effectiveFrom,
      effectiveTo,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/compliance/insurance/policies/${res.id}`);
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <Masthead section="NEW INSURANCE POLICY" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Policy details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <label className="smallcaps text-[0.65rem] block">Entity id</label>
            <input value={entityId} onChange={(e) => setEntityId(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Policy #</label>
              <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Insurer</label>
              <input value={insurerName} onChange={(e) => setInsurerName(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
          </div>
          <div>
            <label className="smallcaps text-[0.65rem] block">Kind</label>
            <select value={policyKind} onChange={(e) => setPolicyKind(e.target.value as typeof policyKind)} className="border border-[var(--rule)] rounded px-2 py-1 w-full">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Coverage (PKR)</label>
              <input value={coveragePkr} onChange={(e) => setCoveragePkr(e.target.value)} inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Premium (PKR)</label>
              <input value={premiumPkr} onChange={(e) => setPremiumPkr(e.target.value)} inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Effective from</label>
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Effective to</label>
              <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
            </div>
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <button disabled={busy} onClick={submit} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy ? 'Creating…' : 'Create policy'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
