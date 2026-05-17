'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { soilTestCreateSchema, type SoilTestCreateInput } from '@zameen/shared/validators';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, PhotoCapture } from '@zameen/ui';
import { createSoilTest } from '../actions';

export function SoilTestForm({ fieldId }: { fieldId: string }) {
  const form = useForm<SoilTestCreateInput>({
    resolver: zodResolver(soilTestCreateSchema),
    defaultValues: { fieldId, reportPhotoUrls: [], testedOn: new Date().toISOString() },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const result = await createSoilTest(values);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/fields/${fieldId}`;
  });

  const photos = form.watch('reportPhotoUrls') ?? [];

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader><CardTitle>New soil test</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tested on</Label>
              <Input type="datetime-local" {...form.register('testedOn')} />
            </div>
            <div>
              <Label>Laboratory</Label>
              <Input {...form.register('laboratory')} />
            </div>
            <div>
              <Label>pH</Label>
              <Input type="number" step="0.01" {...form.register('ph')} />
            </div>
            <div>
              <Label>Organic matter (%)</Label>
              <Input type="number" step="0.01" {...form.register('organicMatterPct')} />
            </div>
            <div>
              <Label>Nitrogen (ppm)</Label>
              <Input type="number" step="0.01" {...form.register('nitrogenPpm')} />
            </div>
            <div>
              <Label>Phosphorus (ppm)</Label>
              <Input type="number" step="0.01" {...form.register('phosphorusPpm')} />
            </div>
            <div>
              <Label>Potassium (ppm)</Label>
              <Input type="number" step="0.01" {...form.register('potassiumPpm')} />
            </div>
            <div>
              <Label>Salinity (EC)</Label>
              <Input type="number" step="0.01" {...form.register('salinityEc')} />
            </div>
            <div className="col-span-2">
              <Label>Texture</Label>
              <Input {...form.register('texture')} placeholder="loam, clay loam" />
            </div>
          </div>
          <PhotoCapture
            label="Report photos"
            value={photos}
            onChange={(urls) => form.setValue('reportPhotoUrls', urls, { shouldValidate: true })}
            uploadFn={async (file) => {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch('/api/uploads/receipts', { method: 'POST', body: fd });
              const json = await res.json();
              return json.url as string;
            }}
          />
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Save soil test'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
