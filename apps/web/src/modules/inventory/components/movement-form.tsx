'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { produceMovementSchema, type ProduceMovementInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, Textarea } from '@zameen/ui';
import { createProduceMovement } from '../actions';

interface Props {
  lots: Array<{ id: string; lotNumber: string; cropName: string }>;
  locations: Array<{ id: string; code: string; name: string }>;
}

export function MovementForm({ lots, locations }: Props) {
  const form = useForm<ProduceMovementInput>({
    resolver: zodResolver(produceMovementSchema),
    defaultValues: { produceLotId: lots[0]?.id ?? '', toLocationId: locations[0]?.id ?? '', quantityKg: 0 },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await createProduceMovement(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = '/inventory/produce';
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Move lot</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Lot</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('produceLotId')}>
                {lots.map((l) => <option key={l.id} value={l.id}>{l.lotNumber} · {l.cropName}</option>)}
              </select>
            </div>
            <div>
              <Label>From location</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('fromLocationId')}>
                <option value="">— field —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
              </select>
            </div>
            <div>
              <Label>To location</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('toLocationId')}>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Quantity (kg)</Label>
              <Input type="number" step="0.01" {...form.register('quantityKg')} />
            </div>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea {...form.register('reason')} />
          </div>
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Move lot'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
