'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface FieldEditorProps {
  initialGeometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  initialCentroid?: { lat: number; lng: number };
  onChange: (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null, areaAcres: number) => void;
  className?: string;
  height?: number;
}

type Mode = 'draw' | 'edit' | 'move' | 'delete';

const M2_TO_ACRES = 0.000247105;
const DEFAULT_CENTER = { lat: 31.25, lng: 74.15 };

/**
 * Drawable Mapbox map. Lazy-loads mapbox-gl + mapbox-gl-draw on mount.
 * Reports geometry + computed acres up via onChange every time the polygon
 * is created, updated, or deleted.
 */
export function FieldEditor({
  initialGeometry,
  initialCentroid,
  onChange,
  className,
  height = 480,
}: FieldEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<unknown>(null);
  const drawRef = React.useRef<unknown>(null);
  const onChangeRef = React.useRef(onChange);
  const [ready, setReady] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>(initialGeometry ? 'move' : 'draw');
  const [areaAcres, setAreaAcres] = React.useState<number>(0);

  const token = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string | undefined) : undefined;

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const [{ default: mapboxgl }, drawMod, turfAreaMod] = await Promise.all([
        import('mapbox-gl'),
        import('@mapbox/mapbox-gl-draw'),
        import('@turf/area'),
      ]);
      if (cancelled) return;

      // Style sheet for draw control needs to be loaded once.
      if (typeof document !== 'undefined' && !document.getElementById('mapbox-gl-draw-css')) {
        const link = document.createElement('link');
        link.id = 'mapbox-gl-draw-css';
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css';
        document.head.appendChild(link);
      }
      if (typeof document !== 'undefined' && !document.getElementById('mapbox-gl-css')) {
        const link = document.createElement('link');
        link.id = 'mapbox-gl-css';
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css';
        document.head.appendChild(link);
      }

      (mapboxgl as unknown as { accessToken: string }).accessToken = token;

      const center = initialCentroid ?? DEFAULT_CENTER;
      const map = new (mapboxgl as unknown as {
        Map: new (opts: Record<string, unknown>) => unknown;
      }).Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [center.lng, center.lat],
        zoom: 15.5,
      }) as {
        on: (ev: string, cb: (e?: unknown) => void) => void;
        addControl: (c: unknown, pos?: string) => void;
        remove: () => void;
      };
      mapRef.current = map;

      // Compass + scale, bottom-right.
      const Mapbox = mapboxgl as unknown as {
        NavigationControl: new () => unknown;
        ScaleControl: new (opts?: Record<string, unknown>) => unknown;
      };
      map.addControl(new Mapbox.NavigationControl(), 'bottom-right');
      map.addControl(new Mapbox.ScaleControl({ unit: 'metric' }), 'bottom-right');

      const MapboxDraw = (drawMod as unknown as { default: new (opts: Record<string, unknown>) => unknown }).default;
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: initialGeometry ? 'simple_select' : 'draw_polygon',
      }) as {
        add: (g: unknown) => string[];
        getAll: () => { features: Array<{ geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon }> };
        deleteAll: () => void;
        changeMode: (m: string, opts?: Record<string, unknown>) => void;
        trash: () => void;
      };
      drawRef.current = draw;
      map.addControl(draw as unknown, 'top-left');

      const turfArea = (turfAreaMod as unknown as { default: (g: GeoJSON.Geometry) => number }).default;

      const handleUpdate = () => {
        const fc = draw.getAll();
        const feat = fc.features[0];
        if (!feat) {
          setAreaAcres(0);
          onChangeRef.current(null, 0);
          return;
        }
        const sqM = turfArea(feat.geometry as GeoJSON.Geometry);
        const acres = sqM * M2_TO_ACRES;
        setAreaAcres(acres);
        onChangeRef.current(feat.geometry, acres);
      };

      map.on('draw.create', handleUpdate);
      map.on('draw.update', handleUpdate);
      map.on('draw.delete', handleUpdate);

      map.on('load', () => {
        if (initialGeometry) {
          draw.add({ type: 'Feature', properties: {}, geometry: initialGeometry } as unknown);
          const sqM = turfArea(initialGeometry as GeoJSON.Geometry);
          setAreaAcres(sqM * M2_TO_ACRES);
        }
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      m?.remove?.();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setDrawMode = React.useCallback((next: Mode) => {
    const draw = drawRef.current as {
      changeMode: (m: string, opts?: Record<string, unknown>) => void;
      getAll: () => { features: Array<{ id: string }> };
      trash: () => void;
    } | null;
    if (!draw) {
      setMode(next);
      return;
    }
    setMode(next);
    const feats = draw.getAll().features;
    const first = feats[0];
    if (next === 'draw') {
      draw.changeMode('draw_polygon');
    } else if (next === 'edit' && first) {
      draw.changeMode('direct_select', { featureId: first.id });
    } else if (next === 'move') {
      draw.changeMode('simple_select');
    } else if (next === 'delete') {
      draw.trash();
      draw.changeMode('simple_select');
      setMode('move');
    }
  }, []);

  if (!token) {
    return (
      <div
        style={{ height }}
        className={cn(
          'diagonal-hatch flex items-center justify-center rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/40 text-[var(--fg-muted)]',
          className,
        )}
      >
        <div className="text-center">
          <div className="smallcaps text-xs text-[var(--fg-muted)]">Mapbox token required</div>
          <div className="mt-1 text-xs text-[var(--fg-subtle)]">Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the editor.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]', className)}
      style={{ height }}
    >
      <div ref={containerRef} className="absolute inset-0" aria-label="Field editor map" />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pointer-events-auto flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 py-2">
          <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)]/90 p-1 backdrop-blur">
            {(['draw', 'edit', 'move', 'delete'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDrawMode(m)}
                className={cn(
                  'px-3 py-1.5 smallcaps text-[0.65rem] rounded',
                  mode === m
                    ? 'bg-[var(--accent)] text-[var(--bg)]'
                    : 'text-[var(--fg)] hover:bg-[var(--surface-2)]',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-1.5 backdrop-blur">
            <span className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Area</span>
            <span className="tabular ml-2 text-sm text-[var(--fg)]">{areaAcres.toFixed(3)} ac</span>
          </div>
        </div>
      </div>

      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]/80 smallcaps text-xs text-[var(--fg-muted)]">
          Loading map
        </div>
      ) : null}
    </div>
  );
}
