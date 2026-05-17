'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface FieldPolygon {
  id: string;
  code: string;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  cropProfileId?: string | null;
  cropColor?: string;
}

export interface FieldMapProps {
  fields: FieldPolygon[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  height?: number;
}

/**
 * Lazy-loads mapbox-gl only on first mount. Falls back to a diagonal-hatch
 * placeholder if NEXT_PUBLIC_MAPBOX_TOKEN is missing. Real polygons render
 * with crop-coloured fills + ink outlines.
 */
export function FieldMap({ fields, selectedId, onSelect, className, height = 320 }: FieldMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<unknown>(null);
  const [ready, setReady] = React.useState(false);
  const token = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string | undefined) : undefined;

  React.useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const mod = await import('mapbox-gl');
      if (cancelled) return;
      const mapboxgl = mod.default ?? mod;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [74.15, 31.25],
        zoom: 13.5,
      });
      mapRef.current = map;
      map.on('load', () => {
        map.addSource('fields', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: fields.map((f) => ({
              type: 'Feature',
              id: f.id,
              properties: { code: f.code, cropColor: f.cropColor ?? '#2D6A4F' },
              geometry: f.geometry,
            })),
          },
        });
        map.addLayer({
          id: 'fields-fill',
          type: 'fill',
          source: 'fields',
          paint: { 'fill-color': ['get', 'cropColor'], 'fill-opacity': 0.35 },
        });
        map.addLayer({
          id: 'fields-outline',
          type: 'line',
          source: 'fields',
          paint: { 'line-color': '#0F1A12', 'line-width': 1 },
        });
        map.on('click', 'fields-fill', (e) => {
          const id = e.features?.[0]?.id;
          if (id && onSelect) onSelect(String(id));
        });
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      m?.remove?.();
      mapRef.current = null;
    };
  }, [token, fields, onSelect]);

  if (!token) {
    return (
      <div
        style={{ height }}
        className={cn(
          'diagonal-hatch flex items-center justify-center border border-[var(--rule)] text-[var(--ink)]/50',
          className,
        )}
      >
        <span className="smallcaps text-xs">Map preview · token required</span>
      </div>
    );
  }
  return (
    <div className={cn('relative border border-[var(--rule)]', className)} style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Field map" />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center smallcaps text-xs text-[var(--ink)]/60">
          Loading map
        </div>
      ) : null}
      {selectedId ? (
        <div className="absolute left-2 top-2 bg-[var(--paper)] border border-[var(--rule)] px-2 py-1 smallcaps text-[0.65rem]">
          Selected · {selectedId}
        </div>
      ) : null}
    </div>
  );
}
