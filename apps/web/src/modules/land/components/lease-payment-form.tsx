'use client';
import * as React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leasePaymentSchema, type LeasePaymentInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, Textarea } from '@zameen/ui';
import { recordLeasePayment } from '../lease-actions';

export function LeasePaymentForm({ leaseId }: { leaseId: string }) {
  const form = useForm<LeasePaymentInput>({
    resolver: zodResolver(leasePaymentSchema),
    defaultValues: { leaseId, paymentMethod: 'bank_transfer' },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit: SubmitHandler<LeasePaymentInput> = async (v) => {
    setSubmitting(true);
    setErr(null);
    const r = await recordLeasePayment({ ...v, amountPkr: Number(v.amountPkr) });
    setSubmitting(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    window.location.href = `/land/leases/${leaseId}`;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader><CardTitle>Payment details · ادائیگی کی تفصیلات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Paid on · تاریخ</Label>
              <Input type="date" {...form.register('paidOn')} />
            </div>
            <div>
              <Label>Amount (PKR)</Label>
              <Input type="number" step="0.01" {...form.register('amountPkr', { valueAsNumber: true })} />
            </div>
          </div>

          <div>
            <Label>Payment method</Label>
            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('paymentMethod')}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="mobile_wallet">Mobile wallet (Easypaisa/JazzCash)</option>
              <option value="in_kind">In kind</option>
            </select>
          </div>

          <div>
            <Label>Reference number</Label>
            <Input placeholder="Cheque #, transaction ID..." {...form.register('referenceNumber')} />
          </div>

          <div>
            <Label>Receipt URL</Label>
            <Input placeholder="https://..." {...form.register('receiptUrl')} />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={3} {...form.register('notes')} />
          </div>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Record payment'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
