'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { recordContractDelivery } from '@/modules/sales/crm-actions';

export function RecordDeliveryForm({ contractId, remainingKg, pricePerKg }: { contractId: string; remainingKg: number; pricePerKg: number }) {
  const router = useRouter();
  const [kg, setKg] = React.useState<number>(0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const pkr = Number((kg * pricePerKg).toFixed(2));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const f = new FormData(e.currentTarget);
    const lotsRaw = ((f.get('produceLotIds') as string) || '').trim();
    const lots = lotsRaw ? lotsRaw.split(/[\s,]+/).filter(Boolean) : [];
    const res = await recordContractDelivery({
      contractId,
      deliveredOn: f.get('deliveredOn') as string,
      kg,
      pkr,
      produceLotIds: lots,
      deliveryNoteUrl: ((f.get('deliveryNoteUrl') as string) || '').trim() || undefined,
      notes: ((f.get('notes') as string) || '').trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) setErr(res.error);
    else router.refresh();
  }

  const fieldCls = 'mt-1 w-full rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1.5 text-sm';
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
      <label className="block">
        <span className="smallcaps text-[0.7rem]">Delivered on</span>
        <input type="date" name="deliveredOn" required className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">Kg (remaining: {remainingKg.toLocaleString()})</span>
        <input type="number" step="0.01" max={remainingKg} required className={fieldCls} value={kg || ''} onChange={(e) => setKg(Number(e.target.value))} />
      </label>
      <div className="block">
        <span className="smallcaps text-[0.7rem]">Computed PKR @ {pricePerKg}/kg</span>
        <div className="mt-1 tabular text-sm">{pkr.toLocaleString()}</div>
      </div>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">Produce lot IDs (comma/space)</span>
        <input name="produceLotIds" className={fieldCls} />
      </label>
      <label className="md:col-span-2 block">
        <span className="smallcaps text-[0.7rem]">Delivery note URL</span>
        <input name="deliveryNoteUrl" type="url" className={fieldCls} />
      </label>
      <label className="md:col-span-2 block">
        <span className="smallcaps text-[0.7rem]">Notes</span>
        <input name="notes" className={fieldCls} />
      </label>
      {err ? <div className="md:col-span-2 text-xs text-red-700">{err}</div> : null}
      <div className="md:col-span-2 flex justify-end">
        <button disabled={busy || kg <= 0} className="rounded bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm smallcaps disabled:opacity-50">
          {busy ? 'Saving…' : 'Record delivery'}
        </button>
      </div>
    </form>
  );
}
