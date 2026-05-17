'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fieldCreateSchema, type FieldCreateInput } from '@zameen/shared/validators';
import { AreaInput, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label, Textarea } from '@zameen/ui';
import { createField, updateField } from '../actions';
import { parseGeometry } from '@/lib/format';

interface Props {
  blocks: Array<{ id: string; code: string; name: string | null }>;
  defaults?: Partial<FieldCreateInput & { id: string }>;
  mode?: 'create' | 'edit';
}

export function FieldForm({ blocks, defaults, mode = 'create' }: Props) {
  const form = useForm<FieldCreateInput>({
    resolver: zodResolver(fieldCreateSchema),
    defaultValues: {
      blockId: defaults?.blockId ?? blocks[0]?.id ?? '',
      code: defaults?.code ?? '',
      name: defaults?.name ?? '',
      nameUr: defaults?.nameUr ?? '',
      acres: defaults?.acres ?? 0,
      geometry: defaults?.geometry ?? ({ type: 'Polygon', coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] } as never),
      khasraNumbers: defaults?.khasraNumbers ?? [],
      khatooniNumber: defaults?.khatooniNumber ?? '',
      tenure: defaults?.tenure ?? 'owned',
    },
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [geometryRaw, setGeometryRaw] = React.useState<string>(
    defaults?.geometry ? JSON.stringify(defaults.geometry, null, 2) : '',
  );
  const [khasraRaw, setKhasraRaw] = React.useState<string>((defaults?.khasraNumbers ?? []).join(', '));

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    const geom = parseGeometry(geometryRaw);
    if (!geom) {
      setServerError('Geometry must be GeoJSON Polygon or lat,lng pairs (one per line)');
      setSubmitting(false);
      return;
    }
    const payload = {
      ...values,
      geometry: geom as never,
      khasraNumbers: khasraRaw.split(',').map((s) => s.trim()).filter(Boolean),
    };
    const result = mode === 'edit' && defaults?.id
      ? await updateField({ ...payload, id: defaults.id })
      : await createField(payload);
    setSubmitting(false);
    if (!result.ok) setServerError(result.error);
    else window.location.href = `/fields/${result.id}`;
  });

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'edit' ? 'Edit field' : 'Create field'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Block</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register('blockId')}
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} {b.name ? `— ${b.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Field code</Label>
              <Input {...form.register('code')} placeholder="F3" />
            </div>
            <div>
              <Label>Name (English)</Label>
              <Input {...form.register('name')} />
            </div>
            <div>
              <Label>Name (Urdu)</Label>
              <Input dir="rtl" {...form.register('nameUr')} />
            </div>
            <div>
              <Label>Area (acres)</Label>
              <AreaInput
                value={form.watch('acres') ?? 0}
                onChange={(v) => form.setValue('acres', v, { shouldValidate: true })}
              />
            </div>
            <div>
              <Label>Tenure</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register('tenure')}
              >
                <option value="owned">Owned</option>
                <option value="leased_in">Leased in</option>
                <option value="leased_out">Leased out</option>
                <option value="sharecropped">Sharecropped</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label>Khasra numbers (comma separated)</Label>
              <Input value={khasraRaw} onChange={(e) => setKhasraRaw(e.target.value)} />
            </div>
            <div>
              <Label>Khatooni number</Label>
              <Input {...form.register('khatooniNumber')} />
            </div>
          </div>

          <div>
            <Label>Geometry (GeoJSON Polygon or lat,lng per line)</Label>
            <Textarea
              rows={6}
              value={geometryRaw}
              onChange={(e) => setGeometryRaw(e.target.value)}
              placeholder='{"type":"Polygon","coordinates":[[[74.30,31.50],[74.31,31.50],[74.31,31.51],[74.30,31.51],[74.30,31.50]]]}'
            />
          </div>

          {Object.values(form.formState.errors).length > 0 ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {Object.entries(form.formState.errors).map(([k, v]) => (
                <div key={k}>{k}: {(v as { message?: string }).message}</div>
              ))}
            </div>
          ) : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving' : 'Save field'}</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
