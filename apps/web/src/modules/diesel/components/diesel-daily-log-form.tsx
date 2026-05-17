'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dieselDailyLogSchema, type DieselDailyLogInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, PhotoUploader, Textarea } from '@zameen/ui';
import { submitDieselDailyLog } from '../actions';

export function DieselDailyLogForm() {
  const form = useForm<DieselDailyLogInput>({
    resolver: zodResolver(dieselDailyLogSchema),
    defaultValues: { receiptPhotoUrls: [] },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (v) => {
    setSubmitting(true);
    setServerError(null);
    const r = await submitDieselDailyLog(v);
    setSubmitting(false);
    if (!r.ok) setServerError(r.error);
    else window.location.href = '/diesel';
  });

  const photos = form.watch('receiptPhotoUrls') ?? [];

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Daily log</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Date</Label><Input type="date" {...form.register('logDate')} /></div>
            <div><Label>Asset (tractor/equipment)</Label><Input placeholder="UUID" {...form.register('assetId')} /></div>
            <div><Label>Operator name</Label><Input {...form.register('operatorName')} /></div>
            <div><Label>Field served</Label><Input placeholder="UUID" {...form.register('taskFieldId')} /></div>
            <div>
              <Label>Task</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('taskKind')}>
                <option value="">—</option>
                <option value="plough">Plough</option>
                <option value="cultivate">Cultivate</option>
                <option value="sow">Sow</option>
                <option value="spray">Spray</option>
                <option value="harvest">Harvest</option>
                <option value="haulage">Haulage</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><Label>Source tank</Label><Input placeholder="UUID" {...form.register('sourceTankId')} /></div>
            <div><Label>Hour meter start</Label><Input type="number" step="0.01" inputMode="decimal" {...form.register('hourMeterStart')} /></div>
            <div><Label>Hour meter end</Label><Input type="number" step="0.01" inputMode="decimal" {...form.register('hourMeterEnd')} /></div>
            <div><Label>Diesel filled (L)</Label><Input type="number" step="0.01" inputMode="decimal" {...form.register('dieselFilledLiters')} /></div>
            <div><Label>Rate per L (Rs.)</Label><Input type="number" step="0.01" inputMode="decimal" {...form.register('rateLiterPkr')} /></div>
            <div><Label>Idle hours</Label><Input type="number" step="0.01" {...form.register('idleHours')} /></div>
            <div><Label>Breakdown hours</Label><Input type="number" step="0.01" {...form.register('breakdownHours')} /></div>
          </div>

          <PhotoUploader
            label="Receipt / proof photos"
            value={photos}
            onChange={(urls) => form.setValue('receiptPhotoUrls', urls)}
            uploadFn={async (file) => {
              const fd = new FormData(); fd.append('file', file);
              const r = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              return (await r.json()).url as string;
            }}
          />
          <div><Label>Notes</Label><Textarea {...form.register('taskNotes')} /></div>

          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save log'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
