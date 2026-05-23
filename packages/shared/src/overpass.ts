/**
 * OpenStreetMap Overpass API client. Free, no key.
 *
 * Composes a single Overpass QL query for the requested feature kinds within
 * a radius, posts to the public interpreter, and returns features with great
 * circle distance to the origin. Public Overpass instances are rate-limited
 * so callers must cache results (see zameen.nearby_features_cache).
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT_MS = 30_000;

export type NearbyKind =
  | 'mandi'
  | 'canal'
  | 'road'
  | 'tubewell'
  | 'school'
  | 'mosque'
  | 'hospital'
  | 'market'
  | 'rail';

export interface NearbyFeature {
  osmId: string;
  kind: NearbyKind;
  name?: string;
  nameUr?: string;
  lat: number;
  lng: number;
  distanceM: number;
  tags: Record<string, string>;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchWithRetry(init: RequestInit): Promise<Response> {
  try {
    const res = await timedFetch(OVERPASS_URL, init);
    if (res.ok) return res;
    throw new Error(`Overpass ${res.status}`);
  } catch {
    return timedFetch(OVERPASS_URL, init);
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function clauseFor(kind: NearbyKind, radiusM: number, lat: number, lng: number): string {
  const around = `around:${radiusM},${lat},${lng}`;
  switch (kind) {
    case 'mandi':
      return [
        `node["amenity"="marketplace"](${around});`,
        `node["shop"="agrarian"](${around});`,
        `way["amenity"="marketplace"](${around});`,
      ].join('');
    case 'market':
      return `node["shop"](${around});`;
    case 'canal':
      return `way["waterway"~"canal|drain|ditch"](${around});`;
    case 'road':
      return `way["highway"~"primary|secondary|tertiary|trunk|motorway"](${around});`;
    case 'tubewell':
      return [
        `node["man_made"="water_well"](${around});`,
        `node["pump"="manual"](${around});`,
      ].join('');
    case 'school':
      return `node["amenity"="school"](${around});way["amenity"="school"](${around});`;
    case 'mosque':
      return `node["amenity"="place_of_worship"]["religion"="muslim"](${around});`;
    case 'hospital':
      return `node["amenity"~"hospital|clinic"](${around});way["amenity"~"hospital|clinic"](${around});`;
    case 'rail':
      return `way["railway"="rail"](${around});node["railway"="station"](${around});`;
  }
}

function elementCoord(el: OverpassElement): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function inferKind(tags: Record<string, string>, requested: NearbyKind[]): NearbyKind | null {
  if (tags.waterway && (requested.includes('canal'))) return 'canal';
  if (tags.highway && requested.includes('road')) return 'road';
  if (tags.railway && requested.includes('rail')) return 'rail';
  if (tags.man_made === 'water_well' && requested.includes('tubewell')) return 'tubewell';
  if (tags.amenity === 'school' && requested.includes('school')) return 'school';
  if (tags.amenity === 'place_of_worship' && tags.religion === 'muslim' && requested.includes('mosque')) return 'mosque';
  if ((tags.amenity === 'hospital' || tags.amenity === 'clinic') && requested.includes('hospital')) return 'hospital';
  if ((tags.amenity === 'marketplace' || tags.shop === 'agrarian') && requested.includes('mandi')) return 'mandi';
  if (tags.shop && requested.includes('market')) return 'market';
  return null;
}

export async function fetchNearbyFeatures({
  lat,
  lng,
  radiusKm = 10,
  kinds,
}: {
  lat: number;
  lng: number;
  radiusKm?: number;
  kinds: NearbyKind[];
}): Promise<NearbyFeature[]> {
  const radiusM = Math.round(radiusKm * 1000);
  const body =
    `[out:json][timeout:25];(` +
    kinds.map((k) => clauseFor(k, radiusM, lat, lng)).join('') +
    `);out center tags;`;

  let res: Response;
  try {
    res = await fetchWithRetry({
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(body)}`,
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const json = (await res.json()) as OverpassResponse;
  const out: NearbyFeature[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const kind = inferKind(tags, kinds);
    if (!kind) continue;
    const coord = elementCoord(el);
    if (!coord) continue;
    out.push({
      osmId: `${el.type}/${el.id}`,
      kind,
      name: tags.name,
      nameUr: tags['name:ur'],
      lat: coord.lat,
      lng: coord.lng,
      distanceM: Math.round(haversineMeters(lat, lng, coord.lat, coord.lng)),
      tags,
    });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out;
}
