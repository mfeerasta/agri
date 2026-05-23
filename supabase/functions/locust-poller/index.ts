// locust-poller
// Schedule: pg_cron weekly Sunday 04:00 UTC (09:00 PKT). Pulls swarm reports
// within 500km of each entity's primary farm centroid from the last 90 days,
// upserts into zameen.locust_alerts, and fires a high-priority notification
// when a gregarious swarm is within 100km.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const FAO_LOCUST_URL =
  'https://services.arcgis.com/Y8d3WsgZK4DcrSCi/arcgis/rest/services/Locust_Reports/FeatureServer/0/query';
const REQUEST_TIMEOUT_MS = 30_000;
const RADIUS_KM = 500;
const DAYS_BACK = 90;
const ALERT_RADIUS_KM = 100;

interface EntityRow {
  id: string;
  name: string;
}

interface FarmCentroid {
  entity_id: string;
  lat: number;
  lng: number;
}

interface NotifyTarget {
  id: string;
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
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normaliseStage(raw: unknown): 'solitary' | 'transient' | 'gregarious' {
  const v = String(raw ?? '').toLowerCase();
  if (v.includes('greg')) return 'gregarious';
  if (v.includes('trans')) return 'transient';
  return 'solitary';
}

function normaliseSize(raw: unknown): 'small' | 'medium' | 'large' {
  const v = String(raw ?? '').toLowerCase();
  if (v.includes('large') || v.includes('huge')) return 'large';
  if (v.includes('med')) return 'medium';
  return 'small';
}

interface ArcGisFeature {
  attributes: Record<string, unknown>;
  geometry?: { x?: number; y?: number };
}

interface ArcGisResponse {
  features?: ArcGisFeature[];
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

async function queryFao(lat: number, lng: number): Promise<ArcGisFeature[]> {
  const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const params = new URLSearchParams({
    where: `STARTDATE >= DATE '${since}'`,
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '4326',
    distance: String(RADIUS_KM * 1000),
    units: 'esriSRUnit_Meter',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    f: 'json',
    resultRecordCount: '500',
  });
  const url = `${FAO_LOCUST_URL}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`fao ${res.status}`);
  } catch {
    res = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
  }
  const json = (await res.json()) as ArcGisResponse;
  return json.features ?? [];
}

Deno.serve(
  instrument('locust-poller', async () => {
    const supabase = getServiceClient();

    const { data: entitiesRaw, error: entitiesErr } = await supabase
      .from('entities')
      .select('id, name');
    if (entitiesErr) return jsonResponse({ error: entitiesErr.message }, 500);
    const entities = (entitiesRaw ?? []) as EntityRow[];

    // Source centroid: average of all farm centroids (lat/lng columns assumed
    // on farms; fall back to entity's stored coords if present).
    const { data: farmsRaw } = await supabase
      .from('farms')
      .select('entity_id, latitude, longitude');
    const centroidByEntity = new Map<string, FarmCentroid>();
    for (const row of (farmsRaw ?? []) as Array<{
      entity_id: string;
      latitude: number | string | null;
      longitude: number | string | null;
    }>) {
      const lat = typeof row.latitude === 'string' ? Number.parseFloat(row.latitude) : row.latitude;
      const lng =
        typeof row.longitude === 'string' ? Number.parseFloat(row.longitude) : row.longitude;
      if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (!centroidByEntity.has(row.entity_id)) {
        centroidByEntity.set(row.entity_id, { entity_id: row.entity_id, lat, lng });
      }
    }

    let inserts = 0;
    let skipped = 0;
    let highAlerts = 0;

    for (const entity of entities) {
      // Default to Raiwind, Lahore farm if no centroid stored.
      const centroid =
        centroidByEntity.get(entity.id) ?? { entity_id: entity.id, lat: 31.2538, lng: 74.1234 };

      const features = await queryFao(centroid.lat, centroid.lng);
      for (const f of features) {
        const featureLat = f.geometry?.y ?? readNumber(f.attributes, ['Y', 'LAT', 'Latitude']);
        const featureLng = f.geometry?.x ?? readNumber(f.attributes, ['X', 'LON', 'Longitude']);
        if (featureLat === null || featureLng === null) {
          skipped += 1;
          continue;
        }
        const stage = normaliseStage(
          f.attributes['LOCPRESENT'] ?? f.attributes['LOCSTAGE'] ?? f.attributes['CATEGORY'],
        );
        const size = normaliseSize(
          f.attributes['LOCSIZE'] ?? f.attributes['SIZE'] ?? f.attributes['SWARMSIZE'],
        );
        const distance = haversineKm(centroid.lat, centroid.lng, featureLat, featureLng);
        const reportedRaw = readNumber(f.attributes, ['STARTDATE', 'OBSDATE', 'ReportDate']);
        const reportedOn = reportedRaw
          ? new Date(reportedRaw).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        const row = {
          entity_id: entity.id,
          reported_on: reportedOn,
          country: readString(f.attributes, ['COUNTRYID', 'COUNTRY', 'Country']) || 'unknown',
          region: readString(f.attributes, ['AREA', 'REGION', 'PROVINCE']) || null,
          lat: featureLat,
          lng: featureLng,
          swarm_stage: stage,
          size,
          distance_km: Math.round(distance * 100) / 100,
          source_url: 'https://locust-hub-hqfao.hub.arcgis.com/',
        };
        const { error: insErr } = await supabase
          .from('locust_alerts')
          .insert(row);
        if (insErr) {
          if (insErr.code === '23505') {
            skipped += 1;
          } else {
            console.error('locust insert failed', insErr);
          }
          continue;
        }
        inserts += 1;

        if (stage === 'gregarious' && distance <= ALERT_RADIUS_KM) {
          highAlerts += 1;
          const { data: targets } = await supabase
            .from('users')
            .select('id')
            .eq('entity_id', entity.id)
            .in('role', ['director', 'farm_manager']);
          for (const target of ((targets ?? []) as NotifyTarget[])) {
            await supabase.from('notifications').insert({
              recipient_id: target.id,
              entity_id: entity.id,
              channel: 'push',
              category: 'locust_alert',
              title: 'Locust swarm nearby',
              body: `Gregarious swarm detected ${row.distance_km}km from farm (${row.region || row.country}).`,
              body_ur: `${row.distance_km} کلومیٹر پر ٹڈی دل کا جھنڈ`,
              deep_link: '/app/compliance/locust-watch',
              payload: row,
            });
          }
        }
      }
    }

    return jsonResponse({ inserts, skipped, highAlerts, entities: entities.length });
  }),
);
