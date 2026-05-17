'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { BigButton, Input, UrduInput, PhotoCapture, VoiceNote } from '@zameen/ui';
import { t } from '@zameen/locale';
import { useLocaleStore } from '../../../lib/locale-store';
import { uploadPhotoToR2 } from '../../../lib/upload';
import { enqueue, makeIdempotencyKey } from '../../../lib/offline-queue';
import { submitDieselPurchase } from '../actions';

interface Props {
  entityId: string;
  assets: { id: string; code: string; make: string | null; model: string | null }[];
  tanks: { id: string; code: string }[];
}

type Destination = 'tank' | 'asset';

interface FormData {
  vendorName: string;
  vendorLocation?: string;
  quantityLiters: number;
  rateLiterPkr: number;
  paymentMethod: 'cash' | 'credit' | 'bank_transfer' | 'card' | 'fuel_card' | 'cheque';
  destination: Destination;
  filledToTankId?: string;
  filledDirectlyToAssetId?: string;
  notes?: string;
  receiptPhotoUrls: string[];
}

export function DieselPurchaseForm({ entityId, assets, tanks }: Props) {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [error, setError] = React.useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState } = useForm<FormData>({
    defaultValues: {
      vendorName: '',
      quantityLiters: 0,
      rateLiterPkr: 0,
      paymentMethod: 'cash',
      destination: 'tank',
      filledToTankId: tanks[0]?.id,
      receiptPhotoUrls: [],
    },
  });

  const qty = watch('quantityLiters');
  const rate = watch('rateLiterPkr');
  const destination = watch('destination');
  const photos = watch('receiptPhotoUrls');
  const notes = watch('notes');
  const total = Number((qty * rate).toFixed(2));

  async function onSubmit(data: FormData) {
    setError(null);
    if (data.receiptPhotoUrls.length < 1) {
      setError(t('diesel.receipt_required', locale));
      return;
    }

    const payload = {
      entityId,
      purchasedAt: new Date().toISOString(),
      vendorName: data.vendorName,
      vendorLocation: data.vendorLocation,
      quantityLiters: data.quantityLiters,
      rateLiterPkr: data.rateLiterPkr,
      totalPkr: total,
      paymentMethod: data.paymentMethod,
      filledToTankId: data.destination === 'tank' ? data.filledToTankId : undefined,
      filledDirectlyToAssetId: data.destination === 'asset' ? data.filledDirectlyToAssetId : undefined,
      receiptPhotoUrls: data.receiptPhotoUrls,
      notes: data.notes,
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueue({ resource: 'diesel_purchase', operation: 'insert', payload, idempotencyKey: makeIdempotencyKey() });
      router.push('/diesel');
      return;
    }

    const res = await submitDieselPurchase(payload);
    if (!res.ok) { setError(res.error); return; }
    router.push('/diesel');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <label className="block">
        <span className="smallcaps text-[0.72rem] block mb-2">Vendor</span>
        <Input {...register('vendorName')} required className="min-h-[64px]" />
      </label>
      <label className="block">
        <span className="smallcaps text-[0.72rem] block mb-2">Location</span>
        <Input {...register('vendorLocation')} className="min-h-[64px]" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.litres', locale)}</span>
          <Input type="number" inputMode="decimal" step="0.1" {...register('quantityLiters', { valueAsNumber: true })} required className="min-h-[64px]" />
        </label>
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.rate', locale)}</span>
          <Input type="number" inputMode="decimal" step="0.01" {...register('rateLiterPkr', { valueAsNumber: true })} required className="min-h-[64px]" />
        </label>
      </div>

      <div className="border border-[var(--rule)] p-2 text-sm tabular">{t('diesel.total', locale)}: <span className="font-medium">{total.toLocaleString()}</span></div>

      <label className="block">
        <span className="smallcaps text-[0.72rem] block mb-2">Payment</span>
        <select {...register('paymentMethod')} className="w-full border border-[var(--rule)] bg-[var(--paper)] px-3 min-h-[64px]">
          <option value="cash">Cash</option>
          <option value="credit">Credit</option>
          <option value="bank_transfer">Bank</option>
          <option value="card">Card</option>
          <option value="fuel_card">Fuel card</option>
          <option value="cheque">Cheque</option>
        </select>
      </label>

      <div role="tablist" className="flex border border-[var(--rule)]">
        {(['tank', 'asset'] as Destination[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setValue('destination', d)}
            className={
              'flex-1 smallcaps text-sm min-h-[64px] ' +
              (destination === d ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-transparent')
            }
          >
            {d === 'tank' ? 'To tank' : 'To asset'}
          </button>
        ))}
      </div>

      {destination === 'tank' ? (
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.tank', locale)}</span>
          <select {...register('filledToTankId')} className="w-full border border-[var(--rule)] bg-[var(--paper)] px-3 min-h-[64px]">
            {tanks.map((tk) => <option key={tk.id} value={tk.id}>{tk.code}</option>)}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">Asset</span>
          <select {...register('filledDirectlyToAssetId')} className="w-full border border-[var(--rule)] bg-[var(--paper)] px-3 min-h-[64px]">
            {assets.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.make} {a.model}</option>)}
          </select>
        </label>
      )}

      <label className="block">
        <span className="smallcaps text-[0.72rem] block mb-2">{t('task.notes', locale)}</span>
        <UrduInput {...register('notes')} className="min-h-[64px]" />
      </label>
      <VoiceNote onTranscript={(text) => setValue('notes', (notes ?? '') + ' ' + text)} lang={locale === 'en' ? 'en-PK' : 'ur-PK'} />

      <PhotoCapture
        label={`${t('diesel.receipt_required', locale)} *`}
        required
        value={photos ?? []}
        onChange={(urls) => setValue('receiptPhotoUrls', urls)}
        uploadFn={(f) => uploadPhotoToR2(f, 'diesel-purchase')}
      />

      {error ? <p className="text-sm text-[var(--rust)]">{error}</p> : null}
      <BigButton type="submit" tone="success" label={formState.isSubmitting ? '...' : t('action.submit', locale)} disabled={formState.isSubmitting} />
    </form>
  );
}
