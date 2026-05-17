'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dieselPurchaseSchema, type DieselPurchaseInput } from '@zameen/shared/validators';
import type { DieselReceiptExtract } from '@zameen/shared';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfidenceBadge,
  Input,
  Label,
  PhotoUploader,
  Textarea,
} from '@zameen/ui';
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
  const [extract, setExtract] = React.useState<DieselReceiptExtract | null>(null);
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [filledKeys, setFilledKeys] = React.useState<Set<string>>(new Set());
  const lastOcrUrl = React.useRef<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await submitDieselPurchase(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/diesel/purchases/${result.id}`;
  });

  const photos = form.watch('receiptPhotoUrls') ?? [];

  const runOcr = React.useCallback(
    async (imageUrl: string) => {
      if (lastOcrUrl.current === imageUrl) return;
      lastOcrUrl.current = imageUrl;
      setOcrBusy(true);
      try {
        const res = await fetch('/api/ocr/diesel', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { extract: DieselReceiptExtract };
        setExtract(json.extract);
        if (json.extract.confidence >= 0.5) {
          const filled = new Set<string>();
          const setIfEmpty = (key: keyof DieselPurchaseInput, value: unknown) => {
            const current = form.getValues(key);
            if ((current === undefined || current === null || current === '' || current === 0) && value !== null && value !== undefined && value !== '') {
              form.setValue(key, value as never, { shouldValidate: true });
              filled.add(key as string);
            }
          };
          setIfEmpty('vendorName', json.extract.vendorName ?? undefined);
          setIfEmpty('vendorLocation', json.extract.vendorLocation ?? undefined);
          if (json.extract.purchasedAt) {
            const d = new Date(json.extract.purchasedAt);
            if (!Number.isNaN(d.getTime())) {
              setIfEmpty('purchasedAt', d.toISOString().slice(0, 16));
            }
          }
          setIfEmpty('quantityLiters', json.extract.quantityLiters ?? undefined);
          setIfEmpty('rateLiterPkr', json.extract.rateLiterPkr ?? undefined);
          setIfEmpty('totalPkr', json.extract.totalPkr ?? undefined);
          if (json.extract.paymentMethod) {
            setIfEmpty('paymentMethod', json.extract.paymentMethod);
          }
          setFilledKeys(filled);
        } else {
          setFilledKeys(new Set());
        }
      } finally {
        setOcrBusy(false);
      }
    },
    [form],
  );

  React.useEffect(() => {
    if (photos.length > 0) void runOcr(photos[0]!);
  }, [photos, runOcr]);

  const lowConfidence = extract !== null && extract.confidence >= 0.5 && extract.confidence < 0.8;
  const tooLow = extract !== null && extract.confidence < 0.5;

  function amberIf(key: string) {
    return lowConfidence && filledKeys.has(key) ? 'border-amber-400 ring-1 ring-amber-300' : '';
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Purchase details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {extract && extract.confidence >= 0.5 ? (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-sm text-blue-900">
              <span>Extracted from receipt</span>
              <ConfidenceBadge confidence={extract.confidence} />
              {lowConfidence ? <span className="text-amber-700">— please verify amber fields</span> : null}
            </div>
          ) : null}
          {tooLow ? (
            <div className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
              Receipt unclear, please enter values manually.
            </div>
          ) : null}
          {ocrBusy ? <div className="text-xs text-slate-500">Reading receipt...</div> : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendor / pump</Label>
              <Input className={amberIf('vendorName')} title={filledKeys.has('vendorName') && lowConfidence ? 'extracted with low confidence' : undefined} {...form.register('vendorName')} />
            </div>
            <div>
              <Label>Vendor location</Label>
              <Input className={amberIf('vendorLocation')} title={filledKeys.has('vendorLocation') && lowConfidence ? 'extracted with low confidence' : undefined} {...form.register('vendorLocation')} />
            </div>
            <div>
              <Label>Purchased at</Label>
              <Input type="datetime-local" className={amberIf('purchasedAt')} {...form.register('purchasedAt')} />
            </div>
            <div>
              <Label>Payment method</Label>
              <select
                className={`h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm ${amberIf('paymentMethod')}`}
                {...form.register('paymentMethod')}
              >
                {(['cash', 'credit', 'bank_transfer', 'card', 'fuel_card', 'cheque'] as const).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Quantity (litres)</Label>
              <Input type="number" step="0.01" inputMode="decimal" className={amberIf('quantityLiters')} title={filledKeys.has('quantityLiters') && lowConfidence ? 'extracted with low confidence' : undefined} {...form.register('quantityLiters')} />
            </div>
            <div>
              <Label>Rate per litre (Rs.)</Label>
              <Input type="number" step="0.01" inputMode="decimal" className={amberIf('rateLiterPkr')} title={filledKeys.has('rateLiterPkr') && lowConfidence ? 'extracted with low confidence' : undefined} {...form.register('rateLiterPkr')} />
            </div>
            <div className="col-span-2">
              <Label>Total (Rs.)</Label>
              <Input className={amberIf('totalPkr')} title={filledKeys.has('totalPkr') && lowConfidence ? 'extracted with low confidence' : undefined} {...form.register('totalPkr')} />
              <p className="mt-1 text-xs text-slate-500">Approval required if total over Rs. 50,000.</p>
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
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save and submit'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
