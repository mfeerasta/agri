'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import type { RepairQuoteExtract } from '@zameen/shared';
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
import { submitRepairQuote } from '../actions';

interface PartLine {
  name: string;
  qty: number;
  unitPricePkr: number;
}

interface RepairQuoteFormValues {
  repairRequestId: string;
  workshopName: string;
  workshopContact?: string;
  workshopLocation?: string;
  partsList: PartLine[];
  laborTotalPkr: number;
  etaDays?: number;
  warrantyDays?: number;
  quoteDocumentUrls: string[];
  ocrExtractedText?: string;
}

export function RepairQuoteForm({ repairRequestId }: { repairRequestId: string }) {
  const form = useForm<RepairQuoteFormValues>({
    defaultValues: {
      repairRequestId,
      workshopName: '',
      partsList: [],
      laborTotalPkr: 0,
      quoteDocumentUrls: [],
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [extract, setExtract] = React.useState<RepairQuoteExtract | null>(null);
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [filledKeys, setFilledKeys] = React.useState<Set<string>>(new Set());
  const lastOcrUrl = React.useRef<string | null>(null);

  const docs = form.watch('quoteDocumentUrls') ?? [];

  const runOcr = React.useCallback(
    async (imageUrl: string) => {
      if (lastOcrUrl.current === imageUrl) return;
      lastOcrUrl.current = imageUrl;
      setOcrBusy(true);
      try {
        const res = await fetch('/api/ocr/repair', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { extract: RepairQuoteExtract };
        setExtract(json.extract);
        form.setValue('ocrExtractedText', json.extract.rawText || undefined);
        if (json.extract.confidence >= 0.5) {
          const filled = new Set<string>();
          const setIfEmpty = (key: keyof RepairQuoteFormValues, value: unknown) => {
            const current = form.getValues(key);
            const empty = current === undefined || current === null || current === '' || current === 0 || (Array.isArray(current) && current.length === 0);
            if (empty && value !== null && value !== undefined && value !== '') {
              form.setValue(key, value as never);
              filled.add(key as string);
            }
          };
          setIfEmpty('workshopName', json.extract.workshopName ?? undefined);
          setIfEmpty('workshopContact', json.extract.workshopContact ?? undefined);
          if (Array.isArray(json.extract.partsList) && json.extract.partsList.length > 0) {
            setIfEmpty('partsList', json.extract.partsList);
          }
          setIfEmpty('laborTotalPkr', json.extract.laborTotalPkr ?? undefined);
          setIfEmpty('etaDays', json.extract.etaDays ?? undefined);
          setIfEmpty('warrantyDays', json.extract.warrantyDays ?? undefined);
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
    if (docs.length > 0) void runOcr(docs[0]!);
  }, [docs, runOcr]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await submitRepairQuote(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/repairs/${repairRequestId}`;
  });

  const lowConfidence = extract !== null && extract.confidence >= 0.5 && extract.confidence < 0.8;
  const tooLow = extract !== null && extract.confidence < 0.5;
  const amberIf = (key: string) => (lowConfidence && filledKeys.has(key) ? 'border-amber-400 ring-1 ring-amber-300' : '');

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Workshop quote</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <PhotoUploader
            label="Quote document (photo of workshop slip)"
            value={docs}
            onChange={(urls) => form.setValue('quoteDocumentUrls', urls, { shouldValidate: true })}
            uploadFn={async (file) => {
              const fd = new FormData();
              fd.append('file', file);
              const r = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              return (await r.json()).url as string;
            }}
          />

          {extract && extract.confidence >= 0.5 ? (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-sm text-blue-900">
              <span>Extracted from quote</span>
              <ConfidenceBadge confidence={extract.confidence} />
              {lowConfidence ? <span className="text-amber-700">verify amber fields</span> : null}
            </div>
          ) : null}
          {tooLow ? (
            <div className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
              Quote unclear, please verify and enter manually. Raw text saved with the record.
            </div>
          ) : null}
          {ocrBusy ? <div className="text-xs text-slate-500">Reading slip...</div> : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Workshop</Label>
              <Input className={amberIf('workshopName')} {...form.register('workshopName')} />
            </div>
            <div>
              <Label>Contact</Label>
              <Input className={amberIf('workshopContact')} {...form.register('workshopContact')} />
            </div>
            <div>
              <Label>Labor total (Rs.)</Label>
              <Input type="number" step="0.01" className={amberIf('laborTotalPkr')} {...form.register('laborTotalPkr', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>ETA (days)</Label>
              <Input type="number" step="0.5" className={amberIf('etaDays')} {...form.register('etaDays', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Warranty (days)</Label>
              <Input type="number" className={amberIf('warrantyDays')} {...form.register('warrantyDays', { valueAsNumber: true })} />
            </div>
          </div>

          <div>
            <Label>Parts (auto-extracted)</Label>
            <Textarea
              rows={4}
              readOnly
              value={(form.watch('partsList') ?? []).map((p) => `${p.name} x ${p.qty} @ Rs.${p.unitPricePkr}`).join('\n')}
            />
          </div>

          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save quote'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
