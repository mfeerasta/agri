'use client';
import * as React from 'react';
import Link from 'next/link';
import { FieldMap, type FieldPolygon, type LegendEntry } from '@zameen/ui';

export interface FieldMapField {
  id: string;
  code: string;
  name: string | null;
  acres: number;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  cropName: string | null;
  cropColor: string;
  stage: string | null;
  soilPh: string | null;
}

interface Props {
  fields: FieldMapField[];
}

export function FieldsMapView({ fields }: Props) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = React.useMemo(
    () => fields.find((f) => f.id === selectedId) ?? null,
    [fields, selectedId],
  );

  const legend = React.useMemo<LegendEntry[]>(() => {
    const seen = new Map<string, string>();
    for (const f of fields) {
      const label = f.cropName ?? 'Fallow';
      if (!seen.has(label)) seen.set(label, f.cropColor);
    }
    return Array.from(seen, ([label, color]) => ({ label, color }));
  }, [fields]);

  const polygons: FieldPolygon[] = fields.map((f) => ({
    id: f.id,
    code: f.code,
    geometry: f.geometry,
    cropColor: f.cropColor,
    cropName: f.cropName ?? undefined,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="overflow-hidden rounded-[14px] border border-[var(--border)]">
        <FieldMap
          fields={polygons}
          selectedId={selectedId ?? undefined}
          onSelect={setSelectedId}
          height={640}
          legend={legend}
          styleUrl="mapbox://styles/mapbox/satellite-streets-v12"
        />
      </div>

      <aside className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
        {selected ? (
          <div className="space-y-4">
            <div>
              <div className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Field</div>
              <div className="font-display text-2xl text-[var(--fg)]">{selected.code}</div>
              {selected.name ? <div className="text-sm text-[var(--fg-muted)]">{selected.name}</div> : null}
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-t border-[var(--border)] pt-2">
                <dt className="text-[var(--fg-muted)]">Acres</dt>
                <dd className="tabular text-[var(--fg)]">{selected.acres.toFixed(3)}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2">
                <dt className="text-[var(--fg-muted)]">Current crop</dt>
                <dd className="text-[var(--fg)]">{selected.cropName ?? 'Fallow'}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2">
                <dt className="text-[var(--fg-muted)]">Stage</dt>
                <dd className="text-[var(--fg)]">{selected.stage ?? 'n/a'}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2">
                <dt className="text-[var(--fg-muted)]">Last soil pH</dt>
                <dd className="tabular text-[var(--fg)]">{selected.soilPh ?? 'n/a'}</dd>
              </div>
            </dl>

            <div className="flex gap-2 pt-2">
              <Link
                href={`/fields/${selected.id}` as never}
                className="flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-center text-sm text-[var(--fg)] hover:bg-[var(--surface-2)]"
              >
                View
              </Link>
              <Link
                href={`/fields/${selected.id}/edit` as never}
                className="flex-1 rounded-md bg-[var(--accent)] px-3 py-2 text-center text-sm font-medium text-[var(--bg)] hover:opacity-90"
              >
                Edit polygon
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <div className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Click a field</div>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              Tap any polygon on the map to inspect crop, stage, and soil details.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
