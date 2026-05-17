'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetHourMeterSchema, type AssetHourMeterInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label } from '@zameen/ui';
import { recordAssetHourMeter } from '../actions';

export function HourMeterForm({ assetId }: { assetId: string }) {
  const form = useForm<AssetHourMeterInput>({
    resolver: zodResolver(assetHourMeterSchema),
    defaultValues: { assetId, recordedOn: new Date().toISOString(), meterReading: 0, source: 'manual' },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await recordAssetHourMeter(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/inventory/assets/${assetId}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Record hour meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Recorded on</Label>
              <Input type="datetime-local" {...form.register('recordedOn')} />
            </div>
            <div>
              <Label>Meter reading</Label>
              <Input type="number" step="0.01" {...form.register('meterReading')} />
            </div>
            <div>
              <Label>Source</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('source')}>
                <option value="manual">manual</option>
                <option value="telematics">telematics</option>
                <option value="diesel_log">diesel_log</option>
              </select>
            </div>
          </div>
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Save reading'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
