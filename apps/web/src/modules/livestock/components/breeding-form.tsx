'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { breedingEventSchema, type BreedingEventInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Textarea } from '@zameen/ui';
import { logBreedingEvent } from '../actions';

export function BreedingForm({ animalId }: { animalId: string }) {
  const form = useForm<BreedingEventInput>({ resolver: zodResolver(breedingEventSchema), defaultValues: { animalId, eventType: 'heat' } });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const onSubmit = form.handleSubmit(async (v) => {
    setSubmitting(true); setErr(null);
    const r = await logBreedingEvent(v);
    setSubmitting(false);
    if (!r.ok) setErr(r.error); else window.location.href = `/livestock/animals/${animalId}`;
  });
  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Breeding event</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Event type</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('eventType')}>
                {(['heat','breeding','pregnancy','calving','abortion'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Event date</label>
              <Input type="date" {...form.register('eventDate')} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Details (free text)</label>
            <Textarea placeholder="Optional notes" onChange={(e) => form.setValue('details', { notes: e.target.value })} />
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
