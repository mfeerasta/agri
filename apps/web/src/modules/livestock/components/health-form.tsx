'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { healthEventSchema, type HealthEventInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Textarea } from '@zameen/ui';
import { logHealthEvent } from '../actions';

export function HealthForm({ entityId, animalId }: { entityId: string; animalId: string }) {
  const form = useForm<HealthEventInput>({
    resolver: zodResolver(healthEventSchema),
    defaultValues: { entityId, animalId, eventType: 'check_up', eventDate: new Date().toISOString().slice(0, 10) },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const onSubmit = form.handleSubmit(async (v) => {
    setSubmitting(true); setErr(null);
    const r = await logHealthEvent(v);
    setSubmitting(false);
    if (!r.ok) setErr(r.error); else window.location.href = `/livestock/animals/${animalId}`;
  });
  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Health event</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Event type</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('eventType')}>
                {(['vaccination','treatment','deworming','check_up','injury'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium">Date</label><Input type="date" {...form.register('eventDate')} /></div>
            <div className="col-span-2"><label className="text-sm font-medium">Diagnosis</label><Input {...form.register('diagnosis')} /></div>
            <div className="col-span-2"><label className="text-sm font-medium">Treatment</label><Textarea {...form.register('treatment')} /></div>
            <div>
              <label className="text-sm font-medium">Medicine cost (PKR)</label>
              <Input type="number" step="0.01" {...form.register('medicineCostPkr')} />
            </div>
            <div>
              <label className="text-sm font-medium">Vet cost (PKR)</label>
              <Input type="number" step="0.01" {...form.register('vetCostPkr')} />
            </div>
            <div><label className="text-sm font-medium">Withdrawal until</label><Input type="date" {...form.register('withdrawalUntil')} /></div>
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Log event'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
