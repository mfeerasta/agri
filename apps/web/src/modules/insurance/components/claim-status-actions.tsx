'use client';
import { useState, useTransition } from 'react';
import { updateClaimStatus } from '@/modules/insurance/actions';

const NEXT_STATES: Record<string, Array<'assessor_pending' | 'assessor_done' | 'approved' | 'rejected' | 'paid' | 'closed'>> = {
  reported: ['assessor_pending', 'rejected'],
  assessor_pending: ['assessor_done', 'rejected'],
  assessor_done: ['approved', 'rejected'],
  approved: ['paid', 'closed'],
  paid: ['closed'],
  rejected: ['closed'],
  closed: [],
};

export function ClaimStatusActions({ claimId, currentStatus }: { claimId: string; currentStatus: string }) {
  const options = NEXT_STATES[currentStatus] ?? [];
  const [pending, startTransition] = useTransition();
  const [settled, setSettled] = useState('');
  const [error, setError] = useState<string | null>(null);

  function go(target: (typeof options)[number]) {
    setError(null);
    startTransition(async () => {
      const settledPkr = target === 'paid' && settled ? Number(settled) : undefined;
      const res = await updateClaimStatus(claimId, target, settledPkr);
      if (!res.ok) setError(res.error);
    });
  }

  if (options.length === 0) return <div className="text-xs text-[var(--fg-muted)]">Terminal state, no transitions available.</div>;

  return (
    <div className="space-y-2">
      {options.includes('paid') && (
        <div>
          <label className="smallcaps text-[0.65rem] block">Settled amount (PKR) — required for paid</label>
          <input value={settled} onChange={(e) => setSettled(e.target.value)} inputMode="decimal" className="border border-[var(--rule)] rounded px-2 py-1 tabular" />
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button
            key={o}
            disabled={pending || (o === 'paid' && !settled)}
            onClick={() => go(o)}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
          >
            {o}
          </button>
        ))}
      </div>
      {error && <div className="text-red-600 text-xs">{error}</div>}
    </div>
  );
}
