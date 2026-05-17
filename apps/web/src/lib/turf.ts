import area from '@turf/area';

type AnyGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

const M2_TO_ACRES = 0.000247105;

/**
 * Compute polygon area in acres. Works in browser + server.
 * Uses @turf/area (spherical excess approximation, accurate for field-scale parcels).
 */
export function polygonAreaAcres(geometry: AnyGeometry | null | undefined): number {
  if (!geometry) return 0;
  try {
    const sqMeters = area(geometry as GeoJSON.Geometry);
    return Math.max(0, sqMeters * M2_TO_ACRES);
  } catch {
    return 0;
  }
}

/**
 * Returns true if the given GeoJSON object is a valid Polygon/MultiPolygon with
 * at least one closed ring of three or more vertices.
 */
export function isValidPolygon(g: unknown): g is AnyGeometry {
  if (!g || typeof g !== 'object') return false;
  const geo = g as { type?: string; coordinates?: unknown };
  if (geo.type === 'Polygon') {
    const rings = geo.coordinates as number[][][] | undefined;
    if (!Array.isArray(rings) || rings.length === 0) return false;
    return rings.every((r) => Array.isArray(r) && r.length >= 4);
  }
  if (geo.type === 'MultiPolygon') {
    const polys = geo.coordinates as number[][][][] | undefined;
    if (!Array.isArray(polys) || polys.length === 0) return false;
    return polys.every((p) => Array.isArray(p) && p.every((r) => Array.isArray(r) && r.length >= 4));
  }
  return false;
}

/**
 * Centroid approximation (average of first ring's vertices). Cheap and good
 * enough for default map zoom.
 */
export function polygonCentroid(geometry: AnyGeometry | null | undefined): { lat: number; lng: number } | null {
  if (!geometry) return null;
  const ring =
    geometry.type === 'Polygon'
      ? (geometry.coordinates[0] as number[][] | undefined)
      : ((geometry.coordinates[0]?.[0]) as number[][] | undefined);
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x ?? 0;
    lat += y ?? 0;
  }
  return { lng: lng / ring.length, lat: lat / ring.length };
}
