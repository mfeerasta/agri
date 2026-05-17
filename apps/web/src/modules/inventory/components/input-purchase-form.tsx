'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inputPurchaseSchema, type InputPurchaseInput } from '@zameen/shared/validators';
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
  PkrInput,
  Textarea,
} from '@zameen/ui';
import { createInputPurchase } from '../actions';

interface Props {
  entityId: string;
  inputs: Array<{ id: string; name: string; type: string; unit: string }>;
  vendors: Array<{ id: string; name: string }>;
}

export function InputPurchaseForm({ entityId, inputs, vendors }: Props) {
  const form = useForm<InputPurchaseInput>({
    resolver: zodResolver(inputPurchaseSchema),
    defaultValues: {
      entityId,
      inputId: inputs[0]?.id ?? '',
      purchasedOn: new Date().toISOString(),
      quantity: 0,
      unitPricePkr: 0,
      totalPkr: '0',
      receiptPhotoUrls: [],
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const qty = Number(form.watch('quantity')) || 0;
  const unit = Number(form.watch('unitPricePkr')) || 0;
  React.useEffect(() => {
    form.setValue('totalPkr', (qty * unit).toFixed(2));
  }, [qty, unit, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await createInputPurchase(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = '/inventory/inputs/purchases';
  });

  const photos = form.watch('receiptPhotoUrls') ?? [];

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>New input purchase</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Input</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('inputId')}>
                {inputs.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
              </select>
            </div>
            <div>
              <Label>Vendor</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('vendorId')}>
                <option value="">— none —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Purchased on</Label>
              <Input type="datetime-local" {...form.register('purchasedOn')} />
            </div>
            <div>
              <Label>Invoice number</Label>
              <Input {...form.register('invoiceNumber')} />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" step="0.0001" {...form.register('quantity')} />
            </div>
            <div>
              <Label>Unit price</Label>
              <PkrInput
                value={Number(form.watch('unitPricePkr')) || 0}
                onChange={(v) => form.setValue('unitPricePkr', v)}
              />
            </div>
            <div className="col-span-2">
              <Label>Total (auto)</Label>
              <Input {...form.register('totalPkr')} readOnly />
            </div>
            <div>
              <Label>Expiry date</Label>
              <Input type="datetime-local" {...form.register('expiryDate')} />
            </div>
            <div>
              <Label>Batch number</Label>
              <Input {...form.register('batchNumber')} />
            </div>
          </div>
          <PhotoCapture
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
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Save purchase'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
