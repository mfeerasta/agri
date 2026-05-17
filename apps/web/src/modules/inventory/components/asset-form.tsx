'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetCreateSchema, type AssetCreateInput } from '@zameen/shared/validators';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PkrInput,
  Textarea,
} from '@zameen/ui';
import { createAsset } from '../actions';

const CATEGORIES = ['tractor', 'harvester', 'thresher', 'sprayer', 'tubewell', 'generator', 'implement', 'vehicle', 'building', 'other'] as const;

export function AssetForm({ entityId }: { entityId: string }) {
  const form = useForm<AssetCreateInput>({
    resolver: zodResolver(assetCreateSchema),
    defaultValues: {
      entityId,
      category: 'tractor',
      code: '',
      currentHourMeter: 0,
      purchasePricePkr: '0',
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await createAsset(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/inventory/assets/${result.id}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>New asset</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Asset code</Label>
              <Input {...form.register('code')} placeholder="T-01" />
            </div>
            <div>
              <Label>Category</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Make</Label>
              <Input {...form.register('make')} />
            </div>
            <div>
              <Label>Model</Label>
              <Input {...form.register('model')} />
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" {...form.register('year')} />
            </div>
            <div>
              <Label>Registration #</Label>
              <Input {...form.register('registrationNumber')} />
            </div>
            <div>
              <Label>Engine #</Label>
              <Input {...form.register('engineNumber')} />
            </div>
            <div>
              <Label>Chassis #</Label>
              <Input {...form.register('chassisNumber')} />
            </div>
            <div>
              <Label>Purchase date</Label>
              <Input type="datetime-local" {...form.register('purchaseDate')} />
            </div>
            <div>
              <Label>Purchase price</Label>
              <PkrInput
                value={Number(form.watch('purchasePricePkr')) || 0}
                onChange={(v) => form.setValue('purchasePricePkr', v.toString())}
              />
            </div>
            <div>
              <Label>Useful life (years)</Label>
              <Input type="number" {...form.register('usefulLifeYears')} />
            </div>
            <div>
              <Label>Mfr fuel spec (L/hr)</Label>
              <Input type="number" step="0.01" {...form.register('manufacturerFuelSpecLph')} />
            </div>
            <div>
              <Label>Current hour meter</Label>
              <Input type="number" step="0.01" {...form.register('currentHourMeter')} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea {...form.register('notes')} />
          </div>
          <p className="text-xs text-slate-500">Asset purchases always require approval.</p>
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Save asset'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
