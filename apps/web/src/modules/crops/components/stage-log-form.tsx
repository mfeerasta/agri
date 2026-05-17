'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cropStageLogCreateSchema, type CropStageLogCreateInput } from '@zameen/shared/validators';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PhotoCapture,
  Textarea,
} from '@zameen/ui';
import { logCropStage } from '../actions';

const STAGES = ['planned', 'land_prep', 'sowing', 'germination', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest', 'post_harvest'] as const;

export function StageLogForm({ cropPlanId }: { cropPlanId: string }) {
  const form = useForm<CropStageLogCreateInput>({
    resolver: zodResolver(cropStageLogCreateSchema),
    defaultValues: { cropPlanId, stage: 'vegetative', observedOn: new Date().toISOString(), photoUrls: [] },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await logCropStage(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/crops/plans/${cropPlanId}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Log stage progression</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stage</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('stage')}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Observed on</Label>
              <Input type="datetime-local" {...form.register('observedOn')} />
            </div>
          </div>
          <div>
            <Label>Notes (English)</Label>
            <Textarea {...form.register('notes')} />
          </div>
          <div>
            <Label>Notes (Urdu)</Label>
            <Textarea dir="rtl" {...form.register('notesUr')} />
          </div>
          <PhotoCapture
            label="Stage photos"
            value={form.watch('photoUrls') ?? []}
            onChange={(urls) => form.setValue('photoUrls', urls, { shouldValidate: true })}
            uploadFn={async (file) => {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              const json = await res.json();
              return json.url as string;
            }}
          />
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Log stage'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
