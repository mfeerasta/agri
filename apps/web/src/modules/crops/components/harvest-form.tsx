'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { harvestRecordCreateSchema, type HarvestRecordCreateInput } from '@zameen/shared/validators';
import {
  AreaInput,
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
  WeightInput,
} from '@zameen/ui';
import { logHarvest } from '../actions';

interface Props {
  cropPlanId: string;
  entityId: string;
  storageLocations: Array<{ id: string; code: string; name: string }>;
}

export function HarvestForm({ cropPlanId, entityId, storageLocations }: Props) {
  const form = useForm<HarvestRecordCreateInput>({
    resolver: zodResolver(harvestRecordCreateSchema),
    defaultValues: {
      cropPlanId,
      entityId,
      harvestedOn: new Date().toISOString(),
      acresHarvested: 0,
      grossYieldKg: 0,
      lotNumber: `LOT-${Date.now().toString(36).toUpperCase()}`,
      grade: 'a',
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await logHarvest(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/crops/plans/${cropPlanId}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Log harvest</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Harvested on</Label>
              <Input type="datetime-local" {...form.register('harvestedOn')} />
            </div>
            <div>
              <Label>Lot number</Label>
              <Input {...form.register('lotNumber')} />
            </div>
            <div>
              <Label>Acres harvested</Label>
              <AreaInput
                value={form.watch('acresHarvested') ?? 0}
                onChange={(v) => form.setValue('acresHarvested', v, { shouldValidate: true })}
              />
            </div>
            <div>
              <Label>Gross yield</Label>
              <WeightInput
                value={form.watch('grossYieldKg') ?? 0}
                defaultUnit="mann"
                onChange={(v) => form.setValue('grossYieldKg', v, { shouldValidate: true })}
              />
            </div>
            <div>
              <Label>Moisture %</Label>
              <Input type="number" step="0.01" {...form.register('moisturePct')} />
            </div>
            <div>
              <Label>Grade</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('grade')}>
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
              </select>
            </div>
            <div>
              <Label>Labor cost</Label>
              <PkrInput
                value={form.watch('laborCostPkr') ?? 0}
                onChange={(v) => form.setValue('laborCostPkr', v)}
              />
            </div>
            <div>
              <Label>Machinery cost</Label>
              <PkrInput
                value={form.watch('machineryCostPkr') ?? 0}
                onChange={(v) => form.setValue('machineryCostPkr', v)}
              />
            </div>
            <div className="col-span-2">
              <Label>Storage location</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('storageLocationId')}>
                <option value="">— none —</option>
                {storageLocations.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea {...form.register('notes')} />
            </div>
          </div>
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Log harvest'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
