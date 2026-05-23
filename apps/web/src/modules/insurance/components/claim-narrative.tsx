'use client';
import { useState, useTransition } from 'react';
import { updateClaimNotes } from '@/modules/insurance/claim-narrative-actions';

export function ClaimNarrative({ claimId, initialNotes }: { claimId: string; initialNotes: string | null }): React.JSX.Element {
  const [notes, setNotes] = useState<string>(initialNotes ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<boolean>(false);

  function save(): void {
    setSaved(false);
    start(async () => {
      const res = await updateClaimNotes(claimId, notes);
      if (res.ok) setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        rows={6}
        className="w-full border px-2 py-1 text-sm"
        placeholder="Narrative supporting the claim (damages, witness accounts, agronomy lead-up)…"
      />
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={pending} className="rounded-md bg-emerald-700 px-3 py-1 text-white text-xs disabled:opacity-50">
          {pending ? 'Saving…' : 'Save narrative'}
        </button>
        {saved && <span className="text-xs text-emerald-700">Saved.</span>}
      </div>
    </div>
  );
}
