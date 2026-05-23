'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { selectRfqWinner } from '@/modules/procurement/rfq-actions';

interface QuoteRow {
  id: string;
  vendorName: string;
  totalPkr: number;
}

const REASONS = ['cheapest', 'fastest', 'best_terms', 'best_quality', 'only_available', 'other'] as const;

export function RfqWinnerPicker({
  rfqId,
  quotes,
}: {
  rfqId: string;
  quotes: QuoteRow[];
}): React.JSX.Element {
  const router = useRouter();
  const [quoteId, setQuoteId] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number]>('cheapest');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(): void {
    setErr(null);
    if (!quoteId) {
      setErr('Pick a quote.');
      return;
    }
    if (!note.trim()) {
      setErr('Selection reason note is required for audit.');
      return;
    }
    start(async () => {
      const res = await selectRfqWinner({ rfqId, quoteId, selectionReason: reason, reasonNote: note.trim() });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Select winner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="block">
          <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Quote</span>
          <select
            className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1"
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
          >
            <option value="">— pick —</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.vendorName} · {q.totalPkr.toLocaleString('en-PK')} PKR
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Reason</span>
          <select
            className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1"
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Rationale (audited)</span>
          <textarea
            className="block w-full border border-[var(--rule)] bg-transparent px-2 py-1 mt-1"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this vendor over the others?"
          />
        </label>
        {err ? <div className="text-[var(--danger)] text-xs">{err}</div> : null}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-40"
          >
            {pending ? 'Selecting...' : 'Select winner + raise approval'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
