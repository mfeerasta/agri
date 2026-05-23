'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface FieldPolygonEditorProps {
  /** Existing polygon to load into the editor (edit mode). */
  initialGeometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  /** Optional map starting center; falls back to Raiwind centroid. */
  centerLng?: number;
  centerLat?: number;
  /** Adjacent polygons used to auto-snap drawn vertices within 5m. */
  neighborPolygons?: Array<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  /** Called whenever the polygon changes. acres is computed from the polygon area. */
  onChange: (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null, acres: number) => void;
  className?: string;
  height?: number;
  /** Display labels in Urdu when true. */
  urdu?: boolean;
}

type Mode = 'draw' | 'edit' | 'move' | 'delete';

const M2_TO_ACRES = 0.000247105;
// Raiwind farm centroid.
const DEFAULT_CENTER = { lat: 31.2454, lng: 74.185 };
// Snap tolerance, in meters.
const SNAP_METERS = 5;

interface DrawCtl {
  add: (g: unknown) => string[];
  set: (fc: unknown) => string[];
  getAll: () => { features: Array<{ id: string; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon }> };
  deleteAll: () => void;
  changeMode: (m: string, opts?: Record<string, unknown>) => void;
  trash: () => void;
}

interface MapCtl {
  on: (ev: string, cb: (e?: unknown) => void) => void;
  addControl: (c: unknown, pos?: string) => void;
  remove: () => void;
  flyTo: (opts: Record<string, unknown>) => void;
  fitBounds: (b: unknown, opts?: Record<string, unknown>) => void;
}

const LABELS = {
  en: { draw: 'Draw', edit: 'Edit', move: 'Move', delete: 'Delete', area: 'Area', acres: 'ac', import: 'Import KML/GeoJSON', loading: 'Loading map', tokenRequired: 'Mapbox token required', tokenHint: 'Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the editor.', snapped: 'Snapped to neighbor' },
  ur: { draw: 'بنائیں', edit: 'ترمیم', move: 'حرکت', delete: 'حذف', area: 'رقبہ', acres: 'ایکڑ', import: 'KML/GeoJSON درآمد', loading: 'نقشہ لوڈ ہو رہا ہے', tokenRequired: 'میپ باکس ٹوکن درکار', tokenHint: 'ایڈیٹر چلانے کے لیے NEXT_PUBLIC_MAPBOX_TOKEN سیٹ کریں۔', snapped: 'پڑوسی سے جوڑا گیا' },
};

function ringsOf(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): number[][][] {
  return g.type === 'Polygon'
    ? (g.coordinates as number[][][])
    : ((g.coordinates as number[][][][]).flat() as number[][][]);
}

/**
 * Parses a KML document into a list of GeoJSON polygons. Handles simple
 * <Polygon><outerBoundaryIs><LinearRing><coordinates>lng,lat,alt ...</coordinates>...
 * structures (single and multi). Returns an empty list on parse failure.
 */
function parseKml(text: string): GeoJSON.Polygon[] {
  if (typeof window === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const polys: GeoJSON.Polygon[] = [];
    const polyNodes = doc.getElementsByTagName('Polygon');
    for (let i = 0; i < polyNodes.length; i += 1) {
      const node = polyNodes[i]!;
      const outer = node.getElementsByTagName('outerBoundaryIs')[0];
      if (!outer) continue;
      const coordsNode = outer.getElementsByTagName('coordinates')[0];
      if (!coordsNode || !coordsNode.textContent) continue;
      const ring: number[][] = coordsNode.textContent
        .trim()
        .split(/\s+/)
        .map((s) => s.split(',').map(Number))
        .filter((p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map((p) => [p[0]!, p[1]!]);
      if (ring.length >= 3) {
        const first = ring[0]!;
        const last = ring[ring.length - 1]!;
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
        polys.push({ type: 'Polygon', coordinates: [ring] });
      }
    }
    return polys;
  } catch {
    return [];
  }
}

function parseGeoJsonFile(text: string): Array<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  try {
    const parsed = JSON.parse(text) as unknown;
    const out: Array<GeoJSON.Polygon | GeoJSON.MultiPolygon> = [];
    const collect = (g: unknown) => {
      const geom = g as { type?: string };
      if (geom?.type === 'Polygon' || geom?.type === 'MultiPolygon') {
        out.push(g as GeoJSON.Polygon | GeoJSON.MultiPolygon);
      }
    };
    const root = parsed as { type?: string; features?: Array<{ geometry?: unknown }>; geometry?: unknown };
    if (root?.type === 'FeatureCollection' && Array.isArray(root.features)) {
      for (const f of root.features) collect(f.geometry);
    } else if (root?.type === 'Feature') {
      collect(root.geometry);
    } else {
      collect(root);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Mapbox-based polygon editor for fields. Lazy-loads mapbox-gl,
 * @mapbox/mapbox-gl-draw, @turf/area, @turf/centroid, and
 * @turf/nearest-point-on-line so the bundle stays small and SSR-safe.
 *
 * Computes acres on every change. Auto-snaps drawn vertices to within
 * SNAP_METERS of any neighboring polygon edge to keep adjacent fields
 * sharing a boundary without overlap.
 */
export function FieldPolygonEditor({
  initialGeometry,
  centerLng,
  centerLat,
  neighborPolygons,
  onChange,
  className,
  height = 480,
  urdu = false,
}: FieldPolygonEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mapRef = React.useRef<MapCtl | null>(null);
  const drawRef = React.useRef<DrawCtl | null>(null);
  const onChangeRef = React.useRef(onChange);
  const neighborsRef = React.useRef(neighborPolygons);
  const turfRefs = React.useRef<{
    area?: (g: GeoJSON.Geometry) => number;
    centroid?: (g: GeoJSON.Geometry) => { geometry: { coordinates: [number, number] } };
    nearestOnLine?: (line: unknown, point: unknown, opts?: { units?: string }) => {
      geometry: { coordinates: [number, number] };
      properties: { dist?: number };
    };
  }>({});
  const [ready, setReady] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>(initialGeometry ? 'move' : 'draw');
  const [areaAcres, setAreaAcres] = React.useState<number>(0);
  const [snapNotice, setSnapNotice] = React.useState<boolean>(false);

  const L = urdu ? LABELS.ur : LABELS.en;
  const token =
    typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string | undefined) : undefined;

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  React.useEffect(() => {
    neighborsRef.current = neighborPolygons;
  }, [neighborPolygons]);

  // Snaps polygon vertices to nearby neighbor edges (within SNAP_METERS).
  const snapPolygon = React.useCallback(
    (geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): { geom: GeoJSON.Polygon | GeoJSON.MultiPolygon; snapped: boolean } => {
      const neighbors = neighborsRef.current;
      const nearest = turfRefs.current.nearestOnLine;
      if (!neighbors || neighbors.length === 0 || !nearest) return { geom, snapped: false };
      let didSnap = false;
      const snapPoint = (lng: number, lat: number): [number, number] => {
        const point = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] } };
        let best: { coords: [number, number]; distM: number } | null = null;
        for (const n of neighbors) {
          for (const ring of ringsOf(n)) {
            if (ring.length < 2) continue;
            const line = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: ring as [number, number][] } };
            try {
              const np = nearest(line, point, { units: 'kilometers' });
              const distM = (np.properties.dist ?? Infinity) * 1000;
              if (distM <= SNAP_METERS && (!best || distM < best.distM)) {
                best = { coords: np.geometry.coordinates, distM };
              }
            } catch {
              // ignore
            }
          }
        }
        if (best) {
          didSnap = true;
          return best.coords;
        }
        return [lng, lat];
      };
      const snapRings = (rings: number[][][]): number[][][] =>
        rings.map((ring) => ring.map((pt) => snapPoint(pt[0]!, pt[1]!) as unknown as number[]));
      if (geom.type === 'Polygon') {
        return { geom: { type: 'Polygon', coordinates: snapRings(geom.coordinates as number[][][]) }, snapped: didSnap };
      }
      return {
        geom: {
          type: 'MultiPolygon',
          coordinates: (geom.coordinates as number[][][][]).map((poly) => snapRings(poly)),
        },
        snapped: didSnap,
      };
    },
    [],
  );

  React.useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const [mapboxMod, drawMod, areaMod, centroidMod, nearestMod] = await Promise.all([
        import('mapbox-gl'),
        import('@mapbox/mapbox-gl-draw'),
        import('@turf/area'),
        import('@turf/centroid').catch(() => null),
        import('@turf/nearest-point-on-line').catch(() => null),
      ]);
      if (cancelled) return;

      const mapboxgl = (mapboxMod as unknown as { default?: unknown }).default ?? mapboxMod;

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

      turfRefs.current.area = (areaMod as unknown as { default: (g: GeoJSON.Geometry) => number }).default;
      if (centroidMod) {
        turfRefs.current.centroid = (centroidMod as unknown as {
          default: (g: GeoJSON.Geometry) => { geometry: { coordinates: [number, number] } };
        }).default;
      }
      if (nearestMod) {
        turfRefs.current.nearestOnLine = (nearestMod as unknown as {
          default: (line: unknown, point: unknown, opts?: { units?: string }) => {
            geometry: { coordinates: [number, number] };
            properties: { dist?: number };
          };
        }).default;
      }

      // Resolve initial center: explicit props > initial polygon centroid > default.
      let center: { lat: number; lng: number };
      if (typeof centerLng === 'number' && typeof centerLat === 'number') {
        center = { lng: centerLng, lat: centerLat };
      } else if (initialGeometry && turfRefs.current.centroid) {
        const c = turfRefs.current.centroid(initialGeometry as GeoJSON.Geometry);
        const [lng, lat] = c.geometry.coordinates;
        center = { lng, lat };
      } else {
        center = DEFAULT_CENTER;
      }

      const map = new (mapboxgl as unknown as {
        Map: new (opts: Record<string, unknown>) => unknown;
      }).Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [center.lng, center.lat],
        zoom: 15.5,
      }) as MapCtl;
      mapRef.current = map;

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
      }) as DrawCtl;
      drawRef.current = draw;
      map.addControl(draw as unknown, 'top-left');

      const emit = (snapped: boolean) => {
        const fc = draw.getAll();
        const feat = fc.features[0];
        if (!feat) {
          setAreaAcres(0);
          onChangeRef.current(null, 0);
          return;
        }
        const sqM = turfRefs.current.area!(feat.geometry as GeoJSON.Geometry);
        const acres = sqM * M2_TO_ACRES;
        setAreaAcres(acres);
        onChangeRef.current(feat.geometry, acres);
        if (snapped) {
          setSnapNotice(true);
          window.setTimeout(() => setSnapNotice(false), 1800);
        }
      };

      const handleChange = () => {
        const fc = draw.getAll();
        const feat = fc.features[0];
        if (!feat) {
          emit(false);
          return;
        }
        const { geom, snapped } = snapPolygon(feat.geometry);
        if (snapped) {
          draw.deleteAll();
          draw.add({ type: 'Feature', properties: {}, geometry: geom } as unknown);
        }
        emit(snapped);
      };

      map.on('draw.create', handleChange);
      map.on('draw.update', handleChange);
      map.on('draw.delete', () => emit(false));

      map.on('load', () => {
        if (initialGeometry) {
          draw.add({ type: 'Feature', properties: {}, geometry: initialGeometry } as unknown);
          const sqM = turfRefs.current.area!(initialGeometry as GeoJSON.Geometry);
          setAreaAcres(sqM * M2_TO_ACRES);
        }
        // Render neighbor polygons as a translucent overlay for visual reference.
        const neighbors = neighborsRef.current;
        if (neighbors && neighbors.length > 0) {
          const m = map as unknown as {
            addSource: (id: string, s: unknown) => void;
            addLayer: (l: unknown) => void;
          };
          try {
            m.addSource('neighbor-fields', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: neighbors.map((g, idx) => ({ type: 'Feature', id: idx, properties: {}, geometry: g })),
              },
            });
            m.addLayer({
              id: 'neighbor-fields-fill',
              type: 'fill',
              source: 'neighbor-fields',
              paint: { 'fill-color': '#ffb703', 'fill-opacity': 0.15 },
            });
            m.addLayer({
              id: 'neighbor-fields-line',
              type: 'line',
              source: 'neighbor-fields',
              paint: { 'line-color': '#ffb703', 'line-width': 1, 'line-dasharray': [2, 2] },
            });
          } catch {
            // ignore double-add on hot reload
          }
        }
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current;
      m?.remove?.();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setDrawMode = React.useCallback((next: Mode) => {
    const draw = drawRef.current;
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

  const handleImportClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChosen = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const text = await file.text();
      const ext = file.name.toLowerCase().split('.').pop();
      const polys = ext === 'kml' ? parseKml(text) : parseGeoJsonFile(text);
      const first = polys[0];
      const draw = drawRef.current;
      const map = mapRef.current;
      if (!first || !draw || !map) return;
      draw.deleteAll();
      draw.add({ type: 'Feature', properties: {}, geometry: first } as unknown);
      // Fit bounds to imported polygon.
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
      for (const ring of ringsOf(first)) {
        for (const pt of ring) {
          if (pt[0]! < minLng) minLng = pt[0]!;
          if (pt[0]! > maxLng) maxLng = pt[0]!;
          if (pt[1]! < minLat) minLat = pt[1]!;
          if (pt[1]! > maxLat) maxLat = pt[1]!;
        }
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 48, animate: true, maxZoom: 17 });
      const sqM = turfRefs.current.area?.(first as GeoJSON.Geometry) ?? 0;
      const acres = sqM * M2_TO_ACRES;
      setAreaAcres(acres);
      onChangeRef.current(first, acres);
      setMode('move');
    },
    [],
  );

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
          <div className="smallcaps text-xs text-[var(--fg-muted)]">{L.tokenRequired}</div>
          <div className="mt-1 text-xs text-[var(--fg-subtle)]">{L.tokenHint}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]',
        className,
      )}
      style={{ height }}
      dir={urdu ? 'rtl' : 'ltr'}
    >
      <div ref={containerRef} className="absolute inset-0" aria-label="Field polygon editor map" />

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
                {L[m]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-1.5 smallcaps text-[0.65rem] text-[var(--fg)] backdrop-blur hover:bg-[var(--surface-2)]"
            >
              {L.import}
            </button>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-1.5 backdrop-blur">
              <span className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">{L.area}</span>
              <span className="tabular ml-2 text-sm text-[var(--fg)]">
                {areaAcres.toFixed(3)} {L.acres}
              </span>
            </div>
          </div>
        </div>
        {snapNotice ? (
          <div className="pointer-events-none mx-auto mt-2 rounded-md border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-1 smallcaps text-[0.65rem] text-[var(--fg)] backdrop-blur">
            {L.snapped}
          </div>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".kml,.geojson,.json,application/geo+json,application/vnd.google-earth.kml+xml"
        className="hidden"
        onChange={handleFileChosen}
      />

      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]/80 smallcaps text-xs text-[var(--fg-muted)]">
          {L.loading}
        </div>
      ) : null}
    </div>
  );
}
