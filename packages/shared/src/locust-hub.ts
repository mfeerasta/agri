/**
 * FAO Locust Hub client.
 *
 * Free public ArcGIS FeatureServer hosted by FAO. No API key required.
 * Source: https://locust-hub-hqfao.hub.arcgis.com/
 *
 * Endpoint used:
 *   GET https://services.arcgis.com/Y8d3WsgZK4DcrSCi/arcgis/rest/services/Locust_Reports/FeatureServer/0/query
 *
 * Phase 1 use case: weekly watch for migratory desert-locust swarms within a
 * radius around the farm centroid. Punjab gets occasional incursions from
 * Sindh/Balochistan after Arabian-peninsula breeding seasons.
 */

const FAO_LOCUST_URL =
  'https://services.arcgis.com/Y8d3WsgZK4DcrSCi/arcgis/rest/services/Locust_Reports/FeatureServer/0/query';
const REQUEST_TIMEOUT_MS = 30_000;

export interface LocustReport {
  id: string;
  reportedOn: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  swarmStage: 'solitary' | 'transient' | 'gregarious';
  size: 'small' | 'medium' | 'large';
  distanceKm: number;
  sourceUrl: string;
}

interface FetchArgs {
  lat: number;
  lng: number;
  radiusKm?: number;
  daysBack?: number;
}

interface ArcGisFeature {
  attributes: Record<string, unknown>;
  geometry?: { x?: number; y?: number };
}

interface ArcGisResponse {
  features?: ArcGisFeature[];
  error?: { message?: string };
}

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normaliseStage(raw: unknown): 'solitary' | 'transient' | 'gregarious' {
  const v = String(raw ?? '').toLowerCase();
  if (v.includes('greg')) return 'gregarious';
  if (v.includes('trans')) return 'transient';
  return 'solitary';
}

function normaliseSize(raw: unknown): 'small' | 'medium' | 'large' {
  const v = String(raw ?? '').toLowerCase();
  if (v.includes('large') || v.includes('big') || v.includes('huge')) return 'large';
  if (v.includes('med')) return 'medium';
  return 'small';
}

function readNumber(attrs: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = attrs[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function readString(attrs: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = attrs[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

async function performRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    return await fn();
  }
}

export async function fetchNearbyLocustActivity({
  lat,
  lng,
  radiusKm = 500,
  daysBack = 90,
}: FetchArgs): Promise<LocustReport[]> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const params = new URLSearchParams({
    where: `STARTDATE >= DATE '${since}'`,
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '4326',
    distance: String(radiusKm * 1000),
    units: 'esriSRUnit_Meter',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    f: 'json',
    resultRecordCount: '500',
  });

  const url = `${FAO_LOCUST_URL}?${params.toString()}`;
  const res = await performRetry(async () => {
    const r = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`FAO Locust query failed: ${r.status}`);
    return r;
  });

  const json = (await res.json()) as ArcGisResponse;
  if (json.error) throw new Error(`FAO Locust error: ${json.error.message ?? 'unknown'}`);

  const out: LocustReport[] = [];
  for (const f of json.features ?? []) {
    const attrs = f.attributes ?? {};
    const featureLat = f.geometry?.y ?? readNumber(attrs, ['Y', 'LAT', 'Latitude', 'LATITUDE']);
    const featureLng = f.geometry?.x ?? readNumber(attrs, ['X', 'LON', 'Longitude', 'LONGITUDE']);
    if (featureLat === null || featureLng === null) continue;

    const reportedOnRaw = readNumber(attrs, ['STARTDATE', 'OBSDATE', 'ReportDate']);
    const reportedOn = reportedOnRaw
      ? new Date(reportedOnRaw).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const stage = normaliseStage(attrs['LOCPRESENT'] ?? attrs['LOCSTAGE'] ?? attrs['CATEGORY']);
    const size = normaliseSize(attrs['LOCSIZE'] ?? attrs['SIZE'] ?? attrs['SWARMSIZE']);
    const distance = haversineKm(lat, lng, featureLat, featureLng);
    const objectId = readNumber(attrs, ['OBJECTID', 'OID', 'FID']);

    out.push({
      id: objectId !== null ? String(objectId) : `${featureLat},${featureLng},${reportedOn}`,
      reportedOn,
      country: readString(attrs, ['COUNTRYID', 'COUNTRY', 'Country']),
      region: readString(attrs, ['AREA', 'REGION', 'PROVINCE']),
      lat: featureLat,
      lng: featureLng,
      swarmStage: stage,
      size,
      distanceKm: Math.round(distance * 100) / 100,
      sourceUrl: 'https://locust-hub-hqfao.hub.arcgis.com/',
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}
