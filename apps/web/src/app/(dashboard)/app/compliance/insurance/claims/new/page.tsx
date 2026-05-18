'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider, PhotoUploader } from '@zameen/ui';
import { createClaim } from '@/modules/insurance/actions';

const CAUSES = ['hail', 'flood', 'frost', 'fire', 'theft', 'disease', 'pest', 'drought'] as const;

export default function NewClaimPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const policyId = sp.get('policyId') ?? '';
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [cause, setCause] = useState<(typeof CAUSES)[number]>('hail');
  const [estimatedLossPkr, setEstimatedLossPkr] = useState('');
  const [claimedPkr, setClaimedPkr] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!policyId) {
      setError('Policy id is required');
      return;
    }
    if (photoUrls.length === 0) {
      setError('Upload at least one photo of the incident');
      return;
    }
    setBusy(true);
    const res = await createClaim({
      policyId,
      incidentDate,
      cause,
      estimatedLossPkr: Number(estimatedLossPkr),
      claimedPkr: Number(claimedPkr),
      notes: notes || undefined,
      photoUrls,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/compliance/insurance/claims/${res.id}`);
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <Masthead section="FILE INSURANCE CLAIM" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Incident details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <label className="smallcaps text-[0.65rem] block">Incident date</label>
            <input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="smallcaps text-[0.65rem] block">Cause</label>
            <select value={cause} onChange={(e) => setCause(e.target.value as typeof cause)} className="border border-[var(--rule)] rounded px-2 py-1 w-full">
              {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="smallcaps text-[0.65rem] block">Estimated loss (PKR)</label>
              <input value={estimatedLossPkr} onChange={(e) => setEstimatedLossPkr(e.target.value)} inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
            </div>
            <div>
              <label className="smallcaps text-[0.65rem] block">Claimed (PKR)</label>
              <input value={claimedPkr} onChange={(e) => setClaimedPkr(e.target.value)} inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 w-full tabular" />
            </div>
          </div>
          <div>
            <label className="smallcaps text-[0.65rem] block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-[var(--rule)] rounded px-2 py-1 w-full" rows={3} />
          </div>
          <div>
            <label className="smallcaps text-[0.65rem] block mb-1">Incident photos (required)</label>
            <PhotoUploader onUploaded={(url) => setPhotoUrls((arr) => [...arr, url])} />
            <div className="text-xs text-[var(--fg-muted)] mt-1">{photoUrls.length} photo{photoUrls.length === 1 ? '' : 's'} uploaded</div>
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <button disabled={busy} onClick={submit} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy ? 'Filing…' : 'File claim'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
