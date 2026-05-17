'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BigButton, Input, UrduInput, PhotoCapture, VoiceNote } from '@zameen/ui';
import { t } from '@zameen/locale';
import { useLocaleStore } from '../../../lib/locale-store';
import { uploadPhotoToR2 } from '../../../lib/upload';
import { enqueue, makeIdempotencyKey } from '../../../lib/offline-queue';
import { completeTask } from '../actions';

const schema = z.object({
  hoursWorked: z.coerce.number().nonnegative(),
  notes: z.string().max(2000).optional(),
  proofPhotoUrls: z.array(z.string()).min(1, 'photo required'),
});

type FormData = z.infer<typeof schema>;

export function TaskCompleteForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { proofPhotoUrls: [], notes: '' },
  });

  const photos = watch('proofPhotoUrls');
  const notes = watch('notes');

  async function onSubmit(data: FormData) {
    setError(null);
    const payload = { ...data, taskId };
    const idempotencyKey = makeIdempotencyKey();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueue({ resource: 'task_completion', operation: 'insert', payload, idempotencyKey });
      router.push('/tasks');
      return;
    }
    const res = await completeTask(payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push('/tasks');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <label className="block">
        <span className="smallcaps text-[0.72rem] text-[var(--ink)]/80 block mb-2">{t('task.hours_worked', locale)}</span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.25"
          {...register('hoursWorked', { valueAsNumber: true })}
          className="min-h-[64px] text-lg"
        />
      </label>

      <label className="block">
        <span className="smallcaps text-[0.72rem] text-[var(--ink)]/80 block mb-2">{t('task.notes', locale)}</span>
        <UrduInput {...register('notes')} className="min-h-[64px]" />
      </label>

      <VoiceNote onTranscript={(text) => setValue('notes', (notes ?? '') + ' ' + text)} lang={locale === 'en' ? 'en-PK' : 'ur-PK'} />

      <PhotoCapture
        label={t('task.proof_photo', locale)}
        required
        value={photos ?? []}
        onChange={(urls) => setValue('proofPhotoUrls', urls)}
        uploadFn={(f) => uploadPhotoToR2(f, 'task-completion')}
      />

      {error ? <p className="text-sm text-[var(--rust)]">{error}</p> : null}
      <BigButton type="submit" label={formState.isSubmitting ? '...' : t('task.complete', locale)} tone="success" disabled={formState.isSubmitting} />
    </form>
  );
}
