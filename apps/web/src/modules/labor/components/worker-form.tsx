'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workerCreateSchema, type WorkerCreateInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardHeader, CardTitle, CardFooter, Input, Label, UrduInput } from '@zameen/ui';
import { createWorker } from '../actions';

export function WorkerForm({ defaultEntityId }: { defaultEntityId?: string }) {
  const form = useForm<WorkerCreateInput>({
    resolver: zodResolver(workerCreateSchema),
    defaultValues: { entityId: defaultEntityId, workerType: 'daily_wage' },
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = form.handleSubmit(async (v) => {
    setBusy(true); setErr(null);
    const r = await createWorker(v);
    setBusy(false);
    if (!r.ok) setErr(r.error);
    else window.location.href = '/labor/workers';
  });

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader><CardTitle>Worker details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Code</Label><Input placeholder="W-001" {...form.register('code')} /></div>
            <div>
              <Label>Worker type</Label>
              <select className="w-full bg-transparent border-0 border-b border-[var(--rule)] py-2 text-sm" {...form.register('workerType')}>
                <option value="permanent">Permanent (approval required)</option>
                <option value="seasonal">Seasonal</option>
                <option value="daily_wage">Daily wage</option>
                <option value="contract">Contract</option>
                <option value="piece_rate">Piece rate</option>
              </select>
            </div>
            <div><Label>Full name (English)</Label><Input {...form.register('fullName')} /></div>
            <div><Label>Full name (Urdu)</Label><UrduInput {...form.register('fullNameUr')} /></div>
            <div><Label>Phone</Label><Input placeholder="03xxxxxxxxx" {...form.register('phone')} /></div>
            <div><Label>CNIC last 4</Label><Input maxLength={4} {...form.register('cnicLast4')} /></div>
            <div><Label>Monthly salary (Rs.)</Label><Input type="number" step="0.01" {...form.register('monthlySalaryPkr')} /></div>
            <div><Label>Daily wage (Rs.)</Label><Input type="number" step="0.01" {...form.register('dailyWagePkr')} /></div>
            <div className="col-span-2"><Label>Hire date</Label><Input type="date" {...form.register('hireDate')} /></div>
          </div>
          {err ? <p className="text-sm text-[var(--rust)]">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={busy}>{busy ? 'Saving' : 'Save worker'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
