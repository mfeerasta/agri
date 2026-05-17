'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { BigButton, Input, UrduInput, PhotoCapture, VoiceNote, FieldSelector } from '@zameen/ui';
import { t } from '@zameen/locale';
import { useLocaleStore } from '../../../lib/locale-store';
import { uploadPhotoToR2 } from '../../../lib/upload';
import { enqueue, makeIdempotencyKey } from '../../../lib/offline-queue';
import { submitDieselDailyLog, lastHourMeter } from '../actions';

interface Asset { id: string; code: string; make: string | null; model: string | null; currentHourMeter: number }
interface FieldOpt { id: string; code: string; name: string | null; nameUr: string | null; acres: number }
interface Tank { id: string; code: string }

interface Props {
  entityId: string;
  operatorName: string;
  operatorId: string;
  assets: Asset[];
  fields: FieldOpt[];
  tanks: Tank[];
}

type Source = 'tank' | 'pump';

interface FormData {
  assetId: string;
  hourMeterStart: number;
  hourMeterEnd: number;
  dieselFilledLiters: number;
  rateLiterPkr: number;
  source: Source;
  sourceTankId?: string;
  taskFieldId?: string;
  taskKind?: string;
  taskNotes?: string;
  receiptPhotoUrls: string[];
}

export function DieselLogForm({ entityId, operatorName, operatorId, assets, fields, tanks }: Props) {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [error, setError] = React.useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState } = useForm<FormData>({
    defaultValues: {
      assetId: assets[0]?.id ?? '',
      hourMeterStart: assets[0]?.currentHourMeter ?? 0,
      hourMeterEnd: 0,
      dieselFilledLiters: 0,
      rateLiterPkr: 0,
      source: 'tank',
      sourceTankId: tanks[0]?.id,
      receiptPhotoUrls: [],
    },
  });

  const assetId = watch('assetId');
  const source = watch('source');
  const photos = watch('receiptPhotoUrls');
  const fieldId = watch('taskFieldId');
  const notes = watch('taskNotes');

  React.useEffect(() => {
    if (!assetId) return;
    void (async () => {
      const last = await lastHourMeter(assetId);
      if (last !== null) setValue('hourMeterStart', last);
    })();
  }, [assetId, setValue]);

  async function onSubmit(data: FormData) {
    setError(null);
    if (data.source === 'pump' && data.receiptPhotoUrls.length < 1) {
      setError(t('diesel.receipt_required', locale));
      return;
    }

    const payload = {
      entityId,
      assetId: data.assetId,
      logDate: new Date().toISOString().slice(0, 10),
      operatorId,
      operatorName,
      hourMeterStart: data.hourMeterStart,
      hourMeterEnd: data.hourMeterEnd,
      dieselFilledLiters: data.dieselFilledLiters,
      rateLiterPkr: data.rateLiterPkr,
      sourceTankId: data.source === 'tank' ? data.sourceTankId : undefined,
      taskFieldId: data.taskFieldId,
      taskKind: data.taskKind,
      taskNotes: data.taskNotes,
      receiptPhotoUrls: data.receiptPhotoUrls,
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueue({ resource: 'diesel_daily_log', operation: 'insert', payload, idempotencyKey: makeIdempotencyKey() });
      router.push('/diesel');
      return;
    }
    const res = await submitDieselDailyLog(payload);
    if (!res.ok) { setError(res.error); return; }
    router.push('/diesel');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <label className="block">
        <span className="smallcaps text-[0.72rem] block mb-2">Asset</span>
        <select {...register('assetId')} className="w-full border border-[var(--rule)] bg-[var(--paper)] px-3 min-h-[64px]">
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.code} · {a.make} {a.model}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.hour_meter_start', locale)}</span>
          <Input type="number" inputMode="decimal" step="0.1" {...register('hourMeterStart', { valueAsNumber: true })} className="min-h-[64px]" />
        </label>
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.hour_meter_end', locale)}</span>
          <Input type="number" inputMode="decimal" step="0.1" {...register('hourMeterEnd', { valueAsNumber: true })} className="min-h-[64px]" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.litres', locale)}</span>
          <Input type="number" inputMode="decimal" step="0.1" {...register('dieselFilledLiters', { valueAsNumber: true })} className="min-h-[64px]" />
        </label>
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.rate', locale)}</span>
          <Input type="number" inputMode="decimal" step="0.01" {...register('rateLiterPkr', { valueAsNumber: true })} className="min-h-[64px]" />
        </label>
      </div>

      <div role="tablist" className="flex border border-[var(--rule)]">
        {(['tank', 'pump'] as Source[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setValue('source', s)}
            className={
              'flex-1 smallcaps text-sm min-h-[64px] ' +
              (source === s ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-transparent')
            }
          >
            {s === 'tank' ? t('diesel.tank', locale) : 'Pump'}
          </button>
        ))}
      </div>

      {source === 'tank' ? (
        <label className="block">
          <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.tank', locale)}</span>
          <select {...register('sourceTankId')} className="w-full border border-[var(--rule)] bg-[var(--paper)] px-3 min-h-[64px]">
            {tanks.map((tk) => <option key={tk.id} value={tk.id}>{tk.code}</option>)}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.field', locale)}</span>
        <FieldSelector
          options={fields.map((f) => ({ id: f.id, code: f.code, name: f.name, nameUr: f.nameUr, acres: f.acres }))}
          value={fieldId ?? null}
          onChange={(id) => setValue('taskFieldId', id ?? undefined)}
        />
      </label>

      <label className="block">
        <span className="smallcaps text-[0.72rem] block mb-2">{t('diesel.task', locale)}</span>
        <UrduInput {...register('taskNotes')} className="min-h-[64px]" />
      </label>

      <VoiceNote onTranscript={(text) => setValue('taskNotes', (notes ?? '') + ' ' + text)} lang={locale === 'en' ? 'en-PK' : 'ur-PK'} />

      <PhotoCapture
        label={source === 'pump' ? `${t('diesel.receipt_required', locale)} *` : 'Receipt photo'}
        required={source === 'pump'}
        value={photos ?? []}
        onChange={(urls) => setValue('receiptPhotoUrls', urls)}
        uploadFn={(f) => uploadPhotoToR2(f, 'diesel-log')}
      />

      {error ? <p className="text-sm text-[var(--rust)]">{error}</p> : null}
      <BigButton type="submit" tone="success" label={formState.isSubmitting ? '...' : t('action.submit', locale)} disabled={formState.isSubmitting} />
    </form>
  );
}
