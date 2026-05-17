'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface FieldPolygon {
  id: string;
  code: string;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  cropProfileId?: string | null;
  cropColor?: string;
  cropName?: string;
}

export interface LegendEntry {
  label: string;
  color: string;
}

export interface FieldMapProps {
  fields: FieldPolygon[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  height?: number;
  legend?: LegendEntry[];
  /** Mapbox style URL. Defaults to light-v11. Pass satellite-streets-v12 for satellite overlays. */
  styleUrl?: string;
  /** Center override; auto-fits to features when omitted. */
  center?: { lat: number; lng: number };
  /** Initial zoom override (only used together with `center`). */
  zoom?: number;
}

/**
 * Lazy-loads mapbox-gl only on first mount. Falls back to a diagonal-hatch
 * placeholder if NEXT_PUBLIC_MAPBOX_TOKEN is missing. Real polygons render
 * with crop-coloured fills + ink outlines. Optional legend panel maps crop
 * name to colour.
 */
export function FieldMap({
  fields,
  selectedId,
  onSelect,
  className,
  height = 320,
  legend,
  styleUrl = 'mapbox://styles/mapbox/light-v11',
  center,
  zoom,
}: FieldMapProps) {
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
      const mapboxgl = (mod as unknown as { default?: unknown }).default ?? mod;
      (mapboxgl as unknown as { accessToken: string }).accessToken = token;

      if (typeof document !== 'undefined' && !document.getElementById('mapbox-gl-css')) {
        const link = document.createElement('link');
        link.id = 'mapbox-gl-css';
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css';
        document.head.appendChild(link);
      }

      const map = new (mapboxgl as unknown as { Map: new (o: Record<string, unknown>) => unknown }).Map({
        container: containerRef.current!,
        style: styleUrl,
        center: center ? [center.lng, center.lat] : [74.15, 31.25],
        zoom: zoom ?? 13.5,
      }) as {
        on: (ev: string, cb: (e?: unknown) => void) => void;
        addLayer: (l: unknown) => void;
        addSource: (id: string, s: unknown) => void;
        remove: () => void;
        fitBounds: (b: unknown, opts?: unknown) => void;
      };
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
          paint: { 'fill-color': ['get', 'cropColor'], 'fill-opacity': 0.45 },
        });
        map.addLayer({
          id: 'fields-outline',
          type: 'line',
          source: 'fields',
          paint: { 'line-color': '#0F1A12', 'line-width': 1.5 },
        });
        map.on('click', 'fields-fill', (e) => {
          const ev = e as { features?: Array<{ id: string | number }> };
          const id = ev.features?.[0]?.id;
          if (id && onSelect) onSelect(String(id));
        });

        // Auto-fit to features if no explicit center provided.
        if (!center && fields.length > 0) {
          let minLng = 180;
          let maxLng = -180;
          let minLat = 90;
          let maxLat = -90;
          for (const f of fields) {
            const rings = (
              f.geometry.type === 'Polygon'
                ? (f.geometry.coordinates as number[][][])
                : ((f.geometry.coordinates as number[][][][]).flat())
            ) as number[][][];
            for (const ring of rings) {
              for (const [x, y] of ring) {
                if (x < minLng) minLng = x;
                if (x > maxLng) maxLng = x;
                if (y < minLat) minLat = y;
                if (y > maxLat) maxLat = y;
              }
            }
          }
          if (minLng < maxLng && minLat < maxLat) {
            map.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              { padding: 32, animate: false, maxZoom: 17 },
            );
          }
        }
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      m?.remove?.();
      mapRef.current = null;
    };
  }, [token, fields, onSelect, styleUrl, center, zoom]);

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
      {legend && legend.length > 0 ? (
        <div className="absolute right-2 bottom-2 max-w-[180px] rounded-md border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-2 backdrop-blur">
          <div className="smallcaps mb-1 text-[0.6rem] text-[var(--fg-muted)]">Legend</div>
          <ul className="space-y-1">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-2 text-[0.7rem] text-[var(--fg)]">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
                <span>{l.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
