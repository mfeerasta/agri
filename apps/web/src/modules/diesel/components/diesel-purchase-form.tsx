'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dieselPurchaseSchema, type DieselPurchaseInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, PhotoUploader, Textarea } from '@zameen/ui';
import { submitDieselPurchase } from '../actions';

export function DieselPurchaseForm() {
  const form = useForm<DieselPurchaseInput>({
    resolver: zodResolver(dieselPurchaseSchema),
    defaultValues: {
      paymentMethod: 'cash',
      receiptPhotoUrls: [],
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await submitDieselPurchase(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/diesel/purchases/${result.id}`;
  });

  const photos = form.watch('receiptPhotoUrls') ?? [];

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Purchase details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendor / pump</Label>
              <Input {...form.register('vendorName')} />
            </div>
            <div>
              <Label>Vendor location</Label>
              <Input {...form.register('vendorLocation')} />
            </div>
            <div>
              <Label>Purchased at</Label>
              <Input type="datetime-local" {...form.register('purchasedAt')} />
            </div>
            <div>
              <Label>Payment method</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register('paymentMethod')}
              >
                {(['cash', 'credit', 'bank_transfer', 'card', 'fuel_card', 'cheque'] as const).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Quantity (litres)</Label>
              <Input type="number" step="0.01" inputMode="decimal" {...form.register('quantityLiters')} />
            </div>
            <div>
              <Label>Rate per litre (Rs.)</Label>
              <Input type="number" step="0.01" inputMode="decimal" {...form.register('rateLiterPkr')} />
            </div>
            <div className="col-span-2">
              <Label>Total (Rs.)</Label>
              <Input {...form.register('totalPkr')} />
              <p className="mt-1 text-xs text-slate-500">Approval required if total ≥ Rs. 50,000.</p>
            </div>
          </div>

          <PhotoUploader
            label="Receipt photo (required)"
            required
            value={photos}
            onChange={(urls) => form.setValue('receiptPhotoUrls', urls, { shouldValidate: true })}
            uploadFn={async (file) => {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              const json = await res.json();
              return json.url as string;
            }}
          />

          <div>
            <Label>Notes</Label>
            <Textarea {...form.register('notes')} />
          </div>

          {Object.values(form.formState.errors).length > 0 ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {Object.entries(form.formState.errors).map(([k, v]) => (
                <div key={k}>{k}: {(v as { message?: string }).message}</div>
              ))}
            </div>
          ) : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save and submit'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
