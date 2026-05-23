'use client';
import { useState, useTransition } from 'react';
import { recordEmiPayment } from '@/modules/finance/loan-actions';

export function EmiPaymentButton({ emiId, totalPkr }: { emiId: string; totalPkr: string }): React.JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>(totalPkr);
  const [paidOn, setPaidOn] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(): void {
    setErr(null);
    start(async () => {
      const res = await recordEmiPayment({
        emiId,
        paidPkr: Number(amount),
        paidOn,
        notes: notes || undefined,
      });
      if (!res.ok) setErr(res.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-xs underline">Record payment</button>;
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="border px-2 py-1 w-32" />
      <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="border px-2 py-1 w-32" />
      <input type="text" placeholder="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="border px-2 py-1 w-32" />
      {err && <div className="text-red-700">{err}</div>}
      <div className="flex gap-1">
        <button type="button" onClick={submit} disabled={pending} className="rounded bg-emerald-700 px-2 py-0.5 text-white">
          {pending ? '…' : 'Submit'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border px-2 py-0.5">Cancel</button>
      </div>
    </div>
  );
}
