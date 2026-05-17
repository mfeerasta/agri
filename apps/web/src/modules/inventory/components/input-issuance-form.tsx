'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inputIssuanceSchema, type InputIssuanceInput } from '@zameen/shared/validators';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  FieldSelector,
  Input,
  Label,
  Textarea,
} from '@zameen/ui';
import { createInputIssuance } from '../actions';

interface Props {
  entityId: string;
  inputs: Array<{ id: string; name: string; unit: string }>;
  fields: Array<{ id: string; code: string; name?: string | null; nameUr?: string | null; acres: number; activePlanId?: string | null }>;
  workers: Array<{ id: string; name: string }>;
}

export function InputIssuanceForm({ entityId, inputs, fields, workers }: Props) {
  const form = useForm<InputIssuanceInput>({
    resolver: zodResolver(inputIssuanceSchema),
    defaultValues: {
      entityId,
      inputId: inputs[0]?.id ?? '',
      fieldId: fields[0]?.id ?? '',
      cropPlanId: fields[0]?.activePlanId ?? undefined,
      issuedOn: new Date().toISOString(),
      quantity: 0,
      unitCostPkr: 0,
      totalCostPkr: 0,
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const qty = Number(form.watch('quantity')) || 0;
  const unit = Number(form.watch('unitCostPkr')) || 0;
  React.useEffect(() => {
    form.setValue('totalCostPkr', Number((qty * unit).toFixed(2)));
  }, [qty, unit, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await createInputIssuance(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = '/inventory/inputs';
  });

  const fieldId = form.watch('fieldId');
  React.useEffect(() => {
    const f = fields.find((x) => x.id === fieldId);
    if (f?.activePlanId) form.setValue('cropPlanId', f.activePlanId);
    else form.setValue('cropPlanId', undefined);
  }, [fieldId, fields, form]);

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Issue input to field</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Input</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('inputId')}>
                {inputs.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Issued on</Label>
              <Input type="datetime-local" {...form.register('issuedOn')} />
            </div>
            <div className="col-span-2">
              <Label>Field</Label>
              <FieldSelector
                options={fields.map((f) => ({ id: f.id, code: f.code, name: f.name ?? undefined, nameUr: f.nameUr ?? undefined, acres: f.acres }))}
                value={form.watch('fieldId')}
                onChange={(v) => form.setValue('fieldId', v, { shouldValidate: true })}
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" step="0.0001" {...form.register('quantity')} />
            </div>
            <div>
              <Label>Unit cost (Rs.)</Label>
              <Input type="number" step="0.01" {...form.register('unitCostPkr')} />
            </div>
            <div className="col-span-2">
              <Label>Total cost (auto)</Label>
              <Input {...form.register('totalCostPkr')} readOnly />
            </div>
            <div>
              <Label>Received by</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('receivedBy')}>
                <option value="">—</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Purpose</Label>
              <Input {...form.register('purpose')} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea {...form.register('notes')} />
            </div>
          </div>
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Issue input'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
