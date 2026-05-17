/**
 * Sentinel Hub Process API + Statistical API client.
 *
 * Auth: OAuth2 client_credentials against the Sentinel Hub Keycloak realm.
 * Tokens are cached in-process until ~60s before expiry.
 *
 * Endpoints used:
 *   POST https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token
 *   POST https://services.sentinel-hub.com/api/v1/statistics
 *   POST https://services.sentinel-hub.com/api/v1/process
 *
 * Free-tier quota is more than sufficient for one 100-acre farm at a 5-day
 * Sentinel-2 revisit cadence. We use the Statistical API for stored stats
 * (cheaper) and the Process API only when we need a coloured PNG preview.
 *
 * All calls are timeout-protected at 30s. No third-party SDK.
 */

const SH_BASE = 'https://services.sentinel-hub.com';
const TOKEN_URL = `${SH_BASE}/auth/realms/main/protocol/openid-connect/token`;
const STATS_URL = `${SH_BASE}/api/v1/statistics`;
const PROCESS_URL = `${SH_BASE}/api/v1/process`;
const REQUEST_TIMEOUT_MS = 30_000;

export interface PolygonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCacheEntry | null = null;

function readEnv(name: string): string | undefined {
  const node = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (node?.env && node.env[name]) return node.env[name];
  const deno = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno;
  return deno?.env?.get?.(name);
}

function requireEnv(name: string): string {
  const v = readEnv(name);
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(t);
  }
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

/**
 * Returns a Sentinel Hub OAuth2 access token. Cached until 60s before expiry.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.accessToken;
  }
  const clientId = requireEnv('SENTINEL_HUB_CLIENT_ID');
  const clientSecret = requireEnv('SENTINEL_HUB_CLIENT_SECRET');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sentinel Hub token request failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

function pickFirstRing(geom: PolygonGeometry): number[][] {
  if (geom.type === 'Polygon') {
    return (geom.coordinates as number[][][])[0] ?? [];
  }
  const multi = geom.coordinates as number[][][][];
  return multi[0]?.[0] ?? [];
}

function bbox(geom: PolygonGeometry): [number, number, number, number] {
  let minLng = 180;
  let maxLng = -180;
  let minLat = 90;
  let maxLat = -90;
  const rings =
    geom.type === 'Polygon'
      ? (geom.coordinates as number[][][])
      : (geom.coordinates as number[][][][]).flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minLng) minLng = x;
      if (x > maxLng) maxLng = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

const NDVI_EVALSCRIPT_STATS = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  // Mask clouds / cloud shadows / snow / saturated using Scene Classification.
  const bad = [3, 8, 9, 10, 11].indexOf(s.SCL) >= 0;
  return {
    ndvi: [ndvi],
    dataMask: [s.dataMask && !bad ? 1 : 0]
  };
}`;

const NDVI_EVALSCRIPT_PREVIEW = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 4 }
  };
}
function colorRamp(v) {
  if (v < 0.0) return [0.65, 0.16, 0.16];
  if (v < 0.2) return [0.85, 0.30, 0.20];
  if (v < 0.4) return [0.96, 0.74, 0.36];
  if (v < 0.6) return [0.84, 0.91, 0.40];
  if (v < 0.8) return [0.40, 0.74, 0.36];
  return [0.10, 0.45, 0.20];
}
function evaluatePixel(s) {
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  const c = colorRamp(ndvi);
  return [c[0], c[1], c[2], s.dataMask];
}`;

const TRUE_COLOR_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(s) {
  return [2.5 * s.B04, 2.5 * s.B03, 2.5 * s.B02, s.dataMask];
}`;

export interface StatisticsBucket {
  fromIso: string;
  toIso: string;
  meanNdvi: number;
  minNdvi: number | null;
  maxNdvi: number | null;
  stDevNdvi: number | null;
  samplesNoData: number;
  pixelsCount: number;
  cloudCoverPct: number | null;
}

export interface GetStatisticsArgs {
  polygon: PolygonGeometry;
  fromDate: string; // ISO date
  toDate: string;   // ISO date (exclusive in practice for SH)
  aggregationInterval?: 'P1D' | 'P5D' | 'P10D' | 'P1M';
}

interface RawStatsInterval {
  interval: { from: string; to: string };
  outputs?: {
    ndvi?: {
      bands?: {
        B0?: {
          stats?: {
            mean?: number;
            min?: number;
            max?: number;
            stDev?: number;
            sampleCount?: number;
            noDataCount?: number;
          };
        };
      };
    };
  };
}

interface RawStatsResponse {
  data?: RawStatsInterval[];
}

/**
 * Statistical API: returns NDVI mean/min/max/std per aggregation bucket
 * over the requested time range, masked by the polygon and the Scene
 * Classification cloud mask.
 */
export async function getStatistics(args: GetStatisticsArgs): Promise<StatisticsBucket[]> {
  const token = await getAccessToken();
  const payload = {
    input: {
      bounds: {
        geometry: args.polygon,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: { mosaickingOrder: 'leastCC' },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${args.fromDate}T00:00:00Z`,
        to: `${args.toDate}T23:59:59Z`,
      },
      aggregationInterval: { of: args.aggregationInterval ?? 'P1D' },
      evalscript: NDVI_EVALSCRIPT_STATS,
      resx: 10,
      resy: 10,
    },
    calculations: {
      ndvi: {
        statistics: {
          default: { percentiles: { k: [10, 50, 90] } },
        },
      },
    },
  };

  const res = await fetchWithTimeout(STATS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sentinel Hub statistics failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as RawStatsResponse;
  const buckets: StatisticsBucket[] = [];
  for (const row of json.data ?? []) {
    const ndvi = row.outputs?.ndvi?.bands?.B0?.stats;
    if (!ndvi || ndvi.mean === undefined) continue;
    const totalSamples = (ndvi.sampleCount ?? 0);
    const noData = (ndvi.noDataCount ?? 0);
    const validPixels = Math.max(totalSamples - noData, 0);
    const cloudCover = totalSamples > 0 ? (noData / totalSamples) * 100 : null;
    buckets.push({
      fromIso: row.interval.from,
      toIso: row.interval.to,
      meanNdvi: ndvi.mean,
      minNdvi: ndvi.min ?? null,
      maxNdvi: ndvi.max ?? null,
      stDevNdvi: ndvi.stDev ?? null,
      samplesNoData: noData,
      pixelsCount: validPixels,
      cloudCoverPct: cloudCover,
    });
  }
  return buckets;
}

export interface GetPreviewArgs {
  polygon: PolygonGeometry;
  observedOn: string; // ISO date
  width?: number;
  height?: number;
}

async function postProcess(payload: Record<string, unknown>, accept: string): Promise<Uint8Array> {
  const token = await getAccessToken();
  const res = await fetchWithTimeout(PROCESS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sentinel Hub process failed: ${res.status} ${text}`);
  }
  const buf = await withTimeout(res.arrayBuffer(), REQUEST_TIMEOUT_MS);
  return new Uint8Array(buf);
}

function buildProcessPayload(
  geom: PolygonGeometry,
  observedOn: string,
  width: number,
  height: number,
  evalscript: string,
): Record<string, unknown> {
  const [minLng, minLat, maxLng, maxLat] = bbox(geom);
  // Same-day from/to. Sentinel Hub will pick the matching acquisition.
  return {
    input: {
      bounds: {
        bbox: [minLng, minLat, maxLng, maxLat],
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: {
              from: `${observedOn}T00:00:00Z`,
              to: `${observedOn}T23:59:59Z`,
            },
            mosaickingOrder: 'leastCC',
          },
        },
      ],
    },
    output: {
      width,
      height,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }],
    },
    evalscript,
  };
}

/**
 * NDVI false-colour PNG preview. Red (low NDVI) to green (high NDVI),
 * intuitive for farmers. Pixels outside the polygon footprint are
 * transparent thanks to the dataMask channel.
 */
export async function getNdviPreviewPng(args: GetPreviewArgs): Promise<Uint8Array> {
  const width = args.width ?? 512;
  const height = args.height ?? 512;
  // Touch the first ring just to ensure the polygon is well-formed early.
  if (pickFirstRing(args.polygon).length < 3) throw new Error('Polygon must have >=3 points');
  const payload = buildProcessPayload(args.polygon, args.observedOn, width, height, NDVI_EVALSCRIPT_PREVIEW);
  return postProcess(payload, 'image/png');
}

/**
 * True-colour RGB PNG preview at the same acquisition date as the NDVI
 * tile. Useful as a side-by-side reference.
 */
export async function getTrueColorPng(args: GetPreviewArgs): Promise<Uint8Array> {
  const width = args.width ?? 512;
  const height = args.height ?? 512;
  const payload = buildProcessPayload(args.polygon, args.observedOn, width, height, TRUE_COLOR_EVALSCRIPT);
  return postProcess(payload, 'image/png');
}

export const __ndviInternals = {
  bbox,
  pickFirstRing,
  resetTokenCache(): void {
    tokenCache = null;
  },
};
