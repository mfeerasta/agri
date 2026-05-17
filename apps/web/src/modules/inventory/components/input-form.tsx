'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inputCreateSchema, type InputCreateInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, Textarea } from '@zameen/ui';
import { createInput } from '../actions';

export function InputMasterForm({ entityId }: { entityId: string }) {
  const form = useForm<InputCreateInput>({
    resolver: zodResolver(inputCreateSchema),
    defaultValues: { entityId, type: 'fertilizer', unit: 'kg', expiryTracked: false },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await createInput(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = '/inventory/inputs';
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>New input master</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('type')}>
                {(['seed', 'fertilizer', 'pesticide', 'herbicide', 'fungicide', 'fuel', 'packaging', 'other'] as const).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Name</Label>
              <Input {...form.register('name')} />
            </div>
            <div>
              <Label>Name (Urdu)</Label>
              <Input dir="rtl" {...form.register('nameUr')} />
            </div>
            <div>
              <Label>Brand</Label>
              <Input {...form.register('brand')} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input {...form.register('unit')} placeholder="kg, bag, litre" />
            </div>
            <div>
              <Label>Unit size (kg)</Label>
              <Input type="number" step="0.0001" {...form.register('unitSizeKg')} />
            </div>
            <div>
              <Label>Reorder point</Label>
              <Input type="number" step="0.01" {...form.register('reorderPoint')} />
            </div>
            <div className="flex items-end gap-2">
              <input type="checkbox" {...form.register('expiryTracked')} id="expiry" />
              <Label htmlFor="expiry">Track expiry</Label>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea {...form.register('notes')} />
          </div>
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Save input'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
