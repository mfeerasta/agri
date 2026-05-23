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
  /** Optional NDVI preview image URL (PNG). Used when ndviOverlay='latest'. */
  ndviPreviewUrl?: string | null;
  /** NDVI footprint bounding box [minLng, minLat, maxLng, maxLat]. */
  ndviBbox?: [number, number, number, number] | null;
  /** Latest mean NDVI for the field, 0..1. */
  ndviMean?: number | null;
}

export type NdviOverlayMode = 'none' | 'latest' | 'gradient';

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
  /**
   * NDVI overlay mode.
   *   - 'none' (default): polygons only
   *   - 'latest': render each field's latest NDVI preview PNG as a raster image
   *   - 'gradient': colour polygon fills by the mean NDVI value (no raster)
   */
  ndviOverlay?: NdviOverlayMode;
  /** Show a built-in NDVI toggle pill in the top-right of the map. */
  showNdviToggle?: boolean;
}

const NDVI_LEGEND_STOPS: Array<{ value: number; color: string; label: string }> = [
  { value: 0.0, color: '#a72929', label: '0.0' },
  { value: 0.2, color: '#d94d33', label: '0.2' },
  { value: 0.4, color: '#f5bd5c', label: '0.4' },
  { value: 0.6, color: '#d6e866', label: '0.6' },
  { value: 0.8, color: '#66bd5c', label: '0.8' },
  { value: 1.0, color: '#1a7333', label: '1.0' },
];

function ndviColor(v: number): string {
  if (v < 0.0) return NDVI_LEGEND_STOPS[0].color;
  if (v < 0.2) return NDVI_LEGEND_STOPS[1].color;
  if (v < 0.4) return NDVI_LEGEND_STOPS[2].color;
  if (v < 0.6) return NDVI_LEGEND_STOPS[3].color;
  if (v < 0.8) return NDVI_LEGEND_STOPS[4].color;
  return NDVI_LEGEND_STOPS[5].color;
}

function polygonBbox(geom: FieldPolygon['geometry']): [number, number, number, number] | null {
  const rings = (
    geom.type === 'Polygon'
      ? (geom.coordinates as number[][][])
      : ((geom.coordinates as number[][][][]).flat())
  ) as number[][][];
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  let saw = false;
  for (const ring of rings) {
    for (const pt of ring) {
      const x = pt[0];
      const y = pt[1];
      if (x === undefined || y === undefined) continue;
      saw = true;
      if (x < minLng) minLng = x;
      if (x > maxLng) maxLng = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
    }
  }
  return saw ? [minLng, minLat, maxLng, maxLat] : null;
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
  ndviOverlay = 'none',
  showNdviToggle = false,
}: FieldMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<unknown>(null);
  const [ready, setReady] = React.useState(false);
  const [overlayMode, setOverlayMode] = React.useState<NdviOverlayMode>(ndviOverlay);
  React.useEffect(() => setOverlayMode(ndviOverlay), [ndviOverlay]);
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
        addLayer: (l: unknown, beforeId?: string) => void;
        addSource: (id: string, s: unknown) => void;
        removeLayer: (id: string) => void;
        removeSource: (id: string) => void;
        getLayer: (id: string) => unknown;
        getSource: (id: string) => unknown;
        setPaintProperty: (layer: string, key: string, val: unknown) => void;
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

        // NDVI raster image layers per field. Added in a hidden state; the
        // overlay-mode effect toggles their visibility via opacity.
        for (const f of fields) {
          if (!f.ndviPreviewUrl) continue;
          const bb = f.ndviBbox ?? polygonBbox(f.geometry);
          if (!bb) continue;
          const [minLng, minLat, maxLng, maxLat] = bb;
          const srcId = `ndvi-src-${f.id}`;
          const lyrId = `ndvi-lyr-${f.id}`;
          try {
            map.addSource(srcId, {
              type: 'image',
              url: f.ndviPreviewUrl,
              coordinates: [
                [minLng, maxLat],
                [maxLng, maxLat],
                [maxLng, minLat],
                [minLng, minLat],
              ],
            });
            map.addLayer({
              id: lyrId,
              type: 'raster',
              source: srcId,
              paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 },
            }, 'fields-fill');
          } catch (err) {
            // mapbox throws if we double-add. Safe to ignore on hot reloads.
            console.warn('ndvi layer add failed', err);
          }
        }
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

  // Drive overlay mode -> paint properties on already-loaded layers.
  React.useEffect(() => {
    if (!ready) return;
    const m = mapRef.current as
      | {
          getLayer: (id: string) => unknown;
          setPaintProperty: (layer: string, key: string, val: unknown) => void;
        }
      | null;
    if (!m) return;
    for (const f of fields) {
      const lyrId = `ndvi-lyr-${f.id}`;
      if (m.getLayer(lyrId)) {
        m.setPaintProperty(lyrId, 'raster-opacity', overlayMode === 'latest' ? 0.85 : 0);
      }
    }
    if (m.getLayer('fields-fill')) {
      if (overlayMode === 'gradient') {
        const gradientExpr: unknown[] = ['case'];
        for (const f of fields) {
          gradientExpr.push(['==', ['get', 'code'], f.code]);
          gradientExpr.push(typeof f.ndviMean === 'number' ? ndviColor(f.ndviMean) : (f.cropColor ?? '#2D6A4F'));
        }
        gradientExpr.push('#4B5563');
        m.setPaintProperty('fields-fill', 'fill-color', gradientExpr);
        m.setPaintProperty('fields-fill', 'fill-opacity', 0.65);
      } else {
        m.setPaintProperty('fields-fill', 'fill-color', ['get', 'cropColor']);
        m.setPaintProperty('fields-fill', 'fill-opacity', overlayMode === 'latest' ? 0.15 : 0.45);
      }
    }
  }, [ready, overlayMode, fields]);

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
      {showNdviToggle ? (
        <div className="absolute right-2 top-2 flex gap-1 rounded-md border border-[var(--rule)] bg-[var(--paper)]/90 p-1 backdrop-blur">
          {(['none', 'latest', 'gradient'] as NdviOverlayMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setOverlayMode(m)}
              className={cn(
                'px-2 py-1 smallcaps text-[0.6rem] rounded',
                overlayMode === m
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'text-[var(--ink)] hover:bg-[var(--rule)]',
              )}
            >
              {m === 'none' ? 'Plain' : m === 'latest' ? 'NDVI' : 'Health'}
            </button>
          ))}
        </div>
      ) : null}
      {overlayMode !== 'none' ? (
        <div className="pointer-events-none absolute left-2 bottom-2 rounded-md border border-[var(--rule)] bg-[var(--paper)]/90 px-3 py-2 backdrop-blur">
          <div className="smallcaps mb-1 text-[0.6rem] text-[var(--ink)]/60">NDVI</div>
          <div
            className="h-2 w-32 rounded-sm"
            style={{
              background:
                'linear-gradient(to right, #a72929 0%, #d94d33 20%, #f5bd5c 40%, #d6e866 60%, #66bd5c 80%, #1a7333 100%)',
            }}
          />
          <div className="mt-1 flex justify-between font-mono text-[0.55rem] text-[var(--ink)]/70">
            {NDVI_LEGEND_STOPS.map((s) => (
              <span key={s.label}>{s.label}</span>
            ))}
          </div>
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
