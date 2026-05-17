'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { animalCreateSchema, type AnimalCreateInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, PhotoUploader } from '@zameen/ui';
import { createAnimal } from '../actions';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-sm font-medium text-slate-700">{children}</label>
);

export function AnimalForm({ entityId }: { entityId: string }) {
  const form = useForm<AnimalCreateInput>({
    resolver: zodResolver(animalCreateSchema),
    defaultValues: { entityId, species: 'cattle', sex: 'female' },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const photoUrl = form.watch('photoUrl');

  const onSubmit = form.handleSubmit(async (v) => {
    setSubmitting(true);
    setErr(null);
    const r = await createAnimal(v);
    setSubmitting(false);
    if (!r.ok) setErr(r.error);
    else window.location.href = `/livestock/animals/${r.id}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>Register animal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Ear tag</Label><Input {...form.register('earTag')} /></div>
            <div>
              <Label>Species</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('species')}>
                {(['cattle', 'buffalo', 'goat', 'sheep', 'other'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Breed</Label><Input {...form.register('breed')} /></div>
            <div>
              <Label>Sex</Label>
              <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" {...form.register('sex')}>
                <option value="female">female</option>
                <option value="male">male</option>
              </select>
            </div>
            <div><Label>Date of birth</Label><Input type="date" {...form.register('dob')} /></div>
            <div><Label>Acquisition date</Label><Input type="date" {...form.register('acquisitionDate')} /></div>
            <div><Label>Dam ear tag</Label><Input {...form.register('damEarTag')} /></div>
            <div><Label>Sire ear tag</Label><Input {...form.register('sireEarTag')} /></div>
            <div className="col-span-2">
              <Label>Acquisition price (PKR)</Label>
              <Input type="number" step="0.01" inputMode="decimal" {...form.register('acquisitionPricePkr')} />
              <p className="mt-1 text-xs text-slate-500">Triggers livestock purchase approval.</p>
            </div>
          </div>
          <PhotoUploader
            label="Animal photo"
            value={photoUrl ? [photoUrl] : []}
            onChange={(urls) => form.setValue('photoUrl', urls[0])}
            uploadFn={async (file) => {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              const json = await res.json();
              return json.url as string;
            }}
          />
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Register animal'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
