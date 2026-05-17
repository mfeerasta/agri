'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cropPlanCreateSchema, type CropPlanCreateInput } from '@zameen/shared/validators';
import {
  AreaInput,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  FieldSelector,
  Input,
  Label,
  PkrInput,
} from '@zameen/ui';
import { createCropPlan } from '../actions';

interface Props {
  entityId: string;
  fieldOptions: Array<{ id: string; code: string; name?: string | null; nameUr?: string | null; acres: number }>;
  cropProfiles: Array<{ id: string; code: string; name: string; season: string }>;
}

export function CropPlanForm({ entityId, fieldOptions, cropProfiles }: Props) {
  const form = useForm<CropPlanCreateInput>({
    resolver: zodResolver(cropPlanCreateSchema),
    defaultValues: {
      entityId,
      fieldId: fieldOptions[0]?.id ?? '',
      cropProfileId: cropProfiles[0]?.id ?? '',
      season: (cropProfiles[0]?.season as 'rabi') ?? 'rabi',
      seasonLabel: 'Rabi 2025-26',
      plannedAcres: 0,
      budgetPkr: '0',
      plannedSowingDate: new Date().toISOString(),
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await createCropPlan(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/crops/plans/${result.id}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>New crop plan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Field</Label>
            <FieldSelector
              options={fieldOptions.map((f) => ({ id: f.id, code: f.code, name: f.name ?? undefined, nameUr: f.nameUr ?? undefined, acres: f.acres }))}
              value={form.watch('fieldId')}
              onChange={(v) => form.setValue('fieldId', v, { shouldValidate: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Crop profile</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register('cropProfileId')}
                onChange={(e) => {
                  form.setValue('cropProfileId', e.target.value);
                  const cp = cropProfiles.find((c) => c.id === e.target.value);
                  if (cp) form.setValue('season', cp.season as 'rabi');
                }}
              >
                {cropProfiles.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.season})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Season</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('season')}>
                {(['rabi', 'kharif', 'zaid', 'perennial'] as const).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Season label</Label>
              <Input {...form.register('seasonLabel')} placeholder="Rabi 2025-26" />
            </div>
            <div>
              <Label>Variety</Label>
              <Input {...form.register('varietyName')} />
            </div>
            <div>
              <Label>Planned sowing date</Label>
              <Input type="datetime-local" {...form.register('plannedSowingDate')} />
            </div>
            <div>
              <Label>Expected yield (per acre)</Label>
              <Input type="number" step="0.01" {...form.register('expectedYieldPerAcre')} />
            </div>
            <div>
              <Label>Planned area (acres)</Label>
              <AreaInput
                value={form.watch('plannedAcres') ?? 0}
                onChange={(v) => form.setValue('plannedAcres', v, { shouldValidate: true })}
              />
            </div>
            <div>
              <Label>Budget</Label>
              <PkrInput
                value={Number(form.watch('budgetPkr')) || 0}
                onChange={(v) => form.setValue('budgetPkr', v.toString())}
              />
            </div>
          </div>
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Create plan'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
