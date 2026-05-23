'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createForwardContract } from '@/modules/sales/crm-actions';

export interface BuyerLite { id: string; name: string; nameUr: string | null }

export function NewForwardContractForm({ buyers }: { buyers: BuyerLite[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const f = new FormData(e.currentTarget);
    const entityId = (f.get('entityId') as string).trim();
    const payload = {
      entityId,
      buyerId: f.get('buyerId') as string,
      contractNumber: (f.get('contractNumber') as string).trim(),
      signedOn: f.get('signedOn') as string,
      cropCode: (f.get('cropCode') as string).trim(),
      committedKg: Number(f.get('committedKg')),
      agreedPricePerKgPkr: Number(f.get('agreedPricePerKgPkr')),
      deliveryWindowStart: f.get('deliveryWindowStart') as string,
      deliveryWindowEnd: f.get('deliveryWindowEnd') as string,
      deliveryPoint: ((f.get('deliveryPoint') as string) || '').trim() || undefined,
      paymentTerms: ((f.get('paymentTerms') as string) || '').trim() || undefined,
      advanceReceivedPkr: Number(f.get('advanceReceivedPkr') ?? 0),
      advanceReceivedOn: ((f.get('advanceReceivedOn') as string) || '').trim() || undefined,
      penaltyClause: ((f.get('penaltyClause') as string) || '').trim() || undefined,
      contractDocUrl: ((f.get('contractDocUrl') as string) || '').trim() || undefined,
    };
    const res = await createForwardContract(payload);
    setBusy(false);
    if (!res.ok) setErr(res.error);
    else router.push(`/app/sales/forward-contracts/${res.id}`);
  }

  const L = (en: string, ur: string) => (<span>{en} <span dir="rtl" className="text-[var(--ink)]/60">/ {ur}</span></span>);
  const fieldCls = 'mt-1 w-full rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1.5 text-sm';

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
      <label className="md:col-span-2 block">
        <span className="smallcaps text-[0.7rem]">{L('Entity ID', 'ادارہ شناخت')}</span>
        <input name="entityId" required className={fieldCls} placeholder="uuid" />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Buyer', 'خریدار')}</span>
        <select name="buyerId" required className={fieldCls}>
          <option value="">—</option>
          {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}{b.nameUr ? ` / ${b.nameUr}` : ''}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Contract number', 'معاہدہ نمبر')}</span>
        <input name="contractNumber" required className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Signed on', 'دستخط کی تاریخ')}</span>
        <input type="date" name="signedOn" required className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Crop code', 'فصل')}</span>
        <input name="cropCode" required className={fieldCls} placeholder="wheat / rice / cotton" />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Committed kg', 'مقدار کلوگرام')}</span>
        <input type="number" step="0.01" name="committedKg" required className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Agreed PKR/kg', 'فی کلو روپے')}</span>
        <input type="number" step="0.01" name="agreedPricePerKgPkr" required className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Delivery window start', 'حوالگی آغاز')}</span>
        <input type="date" name="deliveryWindowStart" required className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Delivery window end', 'حوالگی اختتام')}</span>
        <input type="date" name="deliveryWindowEnd" required className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Delivery point', 'حوالگی مقام')}</span>
        <input name="deliveryPoint" className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Payment terms', 'ادائیگی کی شرائط')}</span>
        <input name="paymentTerms" className={fieldCls} placeholder="50% advance, balance on delivery" />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Advance PKR', 'پیشگی روپے')}</span>
        <input type="number" step="0.01" name="advanceReceivedPkr" defaultValue="0" className={fieldCls} />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.7rem]">{L('Advance received on', 'پیشگی کی تاریخ')}</span>
        <input type="date" name="advanceReceivedOn" className={fieldCls} />
      </label>
      <label className="md:col-span-2 block">
        <span className="smallcaps text-[0.7rem]">{L('Penalty clause', 'جرمانے کی شق')}</span>
        <textarea name="penaltyClause" rows={2} className={fieldCls} />
      </label>
      <label className="md:col-span-2 block">
        <span className="smallcaps text-[0.7rem]">{L('Contract doc URL', 'معاہدے کا لنک')}</span>
        <input name="contractDocUrl" type="url" className={fieldCls} />
      </label>
      {err ? <div className="md:col-span-2 text-xs text-red-700">{err}</div> : null}
      <div className="md:col-span-2 flex justify-end">
        <button disabled={busy} className="rounded bg-[var(--ink)] text-[var(--paper)] px-4 py-2 text-sm smallcaps disabled:opacity-50">
          {busy ? 'Saving…' : 'Submit for director approval'}
        </button>
      </div>
    </form>
  );
}
