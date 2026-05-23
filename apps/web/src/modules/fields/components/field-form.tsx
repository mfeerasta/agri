'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fieldCreateSchema, type FieldCreateInput } from '@zameen/shared/validators';
import {
  AreaInput,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  FieldPolygonEditor,
  Input,
  Label,
} from '@zameen/ui';
import { createField, updateField } from '../actions';
import { polygonCentroid } from '@/lib/turf';

interface Props {
  blocks: Array<{ id: string; code: string; name: string | null }>;
  defaults?: Partial<FieldCreateInput & { id: string }>;
  mode?: 'create' | 'edit';
}

type AnyGeom = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export function FieldForm({ blocks, defaults, mode = 'create' }: Props) {
  const initialGeometry = (defaults?.geometry as AnyGeom | undefined) ?? undefined;

  const form = useForm<FieldCreateInput>({
    resolver: zodResolver(fieldCreateSchema),
    defaultValues: {
      blockId: defaults?.blockId ?? blocks[0]?.id ?? '',
      code: defaults?.code ?? '',
      name: defaults?.name ?? '',
      nameUr: defaults?.nameUr ?? '',
      acres: defaults?.acres ?? 0,
      geometry:
        initialGeometry ??
        ({ type: 'Polygon', coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] } as never),
      khasraNumbers: defaults?.khasraNumbers ?? [],
      khatooniNumber: defaults?.khatooniNumber ?? '',
      tenure: defaults?.tenure ?? 'owned',
    },
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [geometry, setGeometry] = React.useState<AnyGeom | null>(initialGeometry ?? null);
  const [autoAcres, setAutoAcres] = React.useState<boolean>(!initialGeometry);
  const [computedAcres, setComputedAcres] = React.useState<number>(0);
  const [khasraRaw, setKhasraRaw] = React.useState<string>((defaults?.khasraNumbers ?? []).join(', '));

  const initialCentroid = React.useMemo(() => polygonCentroid(initialGeometry ?? null) ?? undefined, [initialGeometry]);

  const handleGeometryChange = React.useCallback(
    (g: AnyGeom | null, acres: number) => {
      setGeometry(g);
      setComputedAcres(acres);
      if (g) {
        form.setValue('geometry', g as never, { shouldValidate: true });
        if (autoAcres) form.setValue('acres', Number(acres.toFixed(3)), { shouldValidate: true });
      }
    },
    [autoAcres, form],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError(null);
    if (!geometry) {
      setServerError('Draw the field polygon on the map before saving.');
      setSubmitting(false);
      return;
    }
    const payload = {
      ...values,
      geometry: geometry as never,
      khasraNumbers: khasraRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const result =
      mode === 'edit' && defaults?.id
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
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Block</Label>
              <select
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)]"
                {...form.register('blockId')}
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} {b.name ? `· ${b.name}` : ''}
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
              <div className="flex items-center justify-between">
                <Label>Area (acres)</Label>
                <label className="flex items-center gap-1.5 text-[0.7rem] text-[var(--fg-muted)]">
                  <input
                    type="checkbox"
                    checked={autoAcres}
                    onChange={(e) => setAutoAcres(e.target.checked)}
                  />
                  Auto from polygon
                </label>
              </div>
              <AreaInput
                value={form.watch('acres') ?? 0}
                onChange={(v) => {
                  setAutoAcres(false);
                  form.setValue('acres', v, { shouldValidate: true });
                }}
              />
            </div>
            <div>
              <Label>Tenure</Label>
              <select
                className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)]"
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
            <Label>Geometry</Label>
            <p className="mb-2 text-xs text-[var(--fg-muted)]">
              Tap Draw, click around the field on the satellite map to outline it, then switch to Edit to
              fine-tune individual corners. Area auto-updates from the polygon.
            </p>
            <FieldPolygonEditor
              initialGeometry={initialGeometry}
              centerLng={initialCentroid?.lng}
              centerLat={initialCentroid?.lat}
              onChange={handleGeometryChange}
              height={520}
            />
            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--fg-muted)]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (computedAcres <= 0) return;
                  setAutoAcres(true);
                  form.setValue('acres', Number(computedAcres.toFixed(3)), { shouldValidate: true });
                }}
                disabled={computedAcres <= 0}
              >
                Use computed acres ({computedAcres.toFixed(3)})
              </Button>
              {!autoAcres ? <span>Manual override is on. Toggle Auto from polygon to resync.</span> : null}
            </div>
          </div>

          {Object.values(form.formState.errors).length > 0 ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {Object.entries(form.formState.errors).map(([k, v]) => (
                <div key={k}>
                  {k}: {(v as { message?: string }).message}
                </div>
              ))}
            </div>
          ) : null}
          {serverError ? <p className="text-sm text-red-400">{serverError}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving' : 'Save field'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
