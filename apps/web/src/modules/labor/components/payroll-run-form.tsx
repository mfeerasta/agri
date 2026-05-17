'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { payrollRunSchema, type PayrollRunInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label } from '@zameen/ui';
import { initiatePayrollRun } from '../actions';

export function PayrollRunForm({ defaultEntityId }: { defaultEntityId?: string }) {
  const form = useForm<PayrollRunInput>({
    resolver: zodResolver(payrollRunSchema),
    defaultValues: { entityId: defaultEntityId },
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = form.handleSubmit(async (v) => {
    setBusy(true); setErr(null);
    const r = await initiatePayrollRun(v);
    setBusy(false);
    if (!r.ok) setErr(r.error);
    else window.location.href = `/labor/payroll/${r.id}`;
  });

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader><CardTitle>Period</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Period start</Label><Input type="date" {...form.register('periodStart')} /></div>
            <div><Label>Period end</Label><Input type="date" {...form.register('periodEnd')} /></div>
          </div>
          <p className="text-sm text-[var(--ink)]/60">
            Will pull attendance + piece-rate logs for every active worker, compute net via payroll divisor,
            and queue Director approval for the total.
          </p>
          {err ? <p className="text-sm text-[var(--rust)]">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={busy}>{busy ? 'Computing' : 'Run payroll'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
