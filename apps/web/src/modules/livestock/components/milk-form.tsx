'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { milkRecordSchema, type MilkRecordInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input } from '@zameen/ui';
import { logMilkRecord } from '../actions';

export function MilkForm({ animalId }: { animalId: string }) {
  const form = useForm<MilkRecordInput>({
    resolver: zodResolver(milkRecordSchema),
    defaultValues: { animalId, session: 'morning', recordedOn: new Date().toISOString().slice(0, 10) },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const onSubmit = form.handleSubmit(async (v) => {
    setSubmitting(true); setErr(null);
    const r = await logMilkRecord(v);
    setSubmitting(false);
    if (!r.ok) setErr(r.error); else window.location.href = `/livestock/animals/${animalId}`;
  });
  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Daily milk record</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Date</label><Input type="date" {...form.register('recordedOn')} /></div>
            <div>
              <label className="text-sm font-medium">Session</label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('session')}>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div><label className="text-sm font-medium">Litres</label><Input type="number" step="0.01" {...form.register('litres')} /></div>
            <div><label className="text-sm font-medium">Fat %</label><Input type="number" step="0.01" {...form.register('fatPct')} /></div>
            <div><label className="text-sm font-medium">SNF %</label><Input type="number" step="0.01" {...form.register('snfPct')} /></div>
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save record'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
