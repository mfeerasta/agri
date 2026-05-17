// ndvi-puller
// Schedule: pg_cron daily at 01:00 UTC (06:00 PKT), after Sentinel-2 daily
// processing. For each active field, fetches the cleanest cloud-free NDVI
// observation in the last 7 days from the Sentinel Hub Statistical API,
// renders a coloured PNG preview via the Process API, uploads the PNG to R2,
// and inserts a row into zameen.ndvi_observations.
//
// Idempotent: skips fields that already have an observation for the chosen
// acquisition date. Skips cloudy days (>40% cloud cover).
//
// Required env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SENTINEL_HUB_CLIENT_ID, SENTINEL_HUB_CLIENT_SECRET
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_PUBLIC_BASE (optional; if set, returned image url is `${R2_PUBLIC_BASE}/${key}`)

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
const SH_BASE = 'https://services.sentinel-hub.com';
const TOKEN_URL = `${SH_BASE}/auth/realms/main/protocol/openid-connect/token`;
const STATS_URL = `${SH_BASE}/api/v1/statistics`;
const PROCESS_URL = `${SH_BASE}/api/v1/process`;
const REQUEST_TIMEOUT_MS = 30_000;
const CLOUD_COVER_LIMIT = 40;

interface PolygonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

interface FieldRow {
  id: string;
  geometry: PolygonGeometry | null;
  block_id: string;
}

interface ActiveCropPlanRow {
  id: string;
  field_id: string;
}

interface ExistingRow {
  field_id: string;
  observed_on: string;
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

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
  const clientId = Deno.env.get('SENTINEL_HUB_CLIENT_ID');
  const clientSecret = Deno.env.get('SENTINEL_HUB_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Sentinel Hub credentials missing');
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
  if (!res.ok) throw new Error(`Token failed ${res.status}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

function bbox(geom: PolygonGeometry): [number, number, number, number] {
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  const rings = geom.type === 'Polygon'
    ? geom.coordinates as number[][][]
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

const NDVI_STATS_EVALSCRIPT = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){const ndvi=(s.B08-s.B04)/(s.B08+s.B04);const bad=[3,8,9,10,11].indexOf(s.SCL)>=0;return{ndvi:[ndvi],dataMask:[s.dataMask&&!bad?1:0]};}`;

const NDVI_PREVIEW_EVALSCRIPT = `//VERSION=3
function setup(){return{input:["B04","B08","dataMask"],output:{bands:4}};}
function colorRamp(v){if(v<0.0)return[0.65,0.16,0.16];if(v<0.2)return[0.85,0.30,0.20];if(v<0.4)return[0.96,0.74,0.36];if(v<0.6)return[0.84,0.91,0.40];if(v<0.8)return[0.40,0.74,0.36];return[0.10,0.45,0.20];}
function evaluatePixel(s){const ndvi=(s.B08-s.B04)/(s.B08+s.B04);const c=colorRamp(ndvi);return[c[0],c[1],c[2],s.dataMask];}`;

interface StatsBucket {
  observedOn: string;
  meanNdvi: number;
  minNdvi: number | null;
  maxNdvi: number | null;
  stDevNdvi: number | null;
  pixelsCount: number;
  cloudCoverPct: number | null;
  raw: unknown;
}

interface RawStatsInterval {
  interval: { from: string; to: string };
  outputs?: { ndvi?: { bands?: { B0?: { stats?: { mean?: number; min?: number; max?: number; stDev?: number; sampleCount?: number; noDataCount?: number } } } } };
}

async function pullStats(token: string, polygon: PolygonGeometry, fromDate: string, toDate: string): Promise<StatsBucket[]> {
  const payload = {
    input: {
      bounds: { geometry: polygon, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC' } }],
    },
    aggregation: {
      timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` },
      aggregationInterval: { of: 'P1D' },
      evalscript: NDVI_STATS_EVALSCRIPT,
      resx: 10,
      resy: 10,
    },
    calculations: { ndvi: { statistics: { default: { percentiles: { k: [50] } } } } },
  };
  const res = await fetchWithTimeout(STATS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`stats ${res.status} ${await res.text()}`);
  const json = await res.json() as { data?: RawStatsInterval[] };
  const out: StatsBucket[] = [];
  for (const row of json.data ?? []) {
    const s = row.outputs?.ndvi?.bands?.B0?.stats;
    if (!s || s.mean === undefined) continue;
    const totalSamples = s.sampleCount ?? 0;
    const noData = s.noDataCount ?? 0;
    const validPixels = Math.max(totalSamples - noData, 0);
    const cloudCover = totalSamples > 0 ? (noData / totalSamples) * 100 : null;
    out.push({
      observedOn: row.interval.from.slice(0, 10),
      meanNdvi: s.mean,
      minNdvi: s.min ?? null,
      maxNdvi: s.max ?? null,
      stDevNdvi: s.stDev ?? null,
      pixelsCount: validPixels,
      cloudCoverPct: cloudCover,
      raw: row,
    });
  }
  return out;
}

async function pullPreviewPng(token: string, polygon: PolygonGeometry, observedOn: string): Promise<Uint8Array> {
  const [minLng, minLat, maxLng, maxLat] = bbox(polygon);
  const payload = {
    input: {
      bounds: { bbox: [minLng, minLat, maxLng, maxLat], properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [{
        type: 'sentinel-2-l2a',
        dataFilter: { timeRange: { from: `${observedOn}T00:00:00Z`, to: `${observedOn}T23:59:59Z` }, mosaickingOrder: 'leastCC' },
      }],
    },
    output: { width: 512, height: 512, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
    evalscript: NDVI_PREVIEW_EVALSCRIPT,
  };
  const res = await fetchWithTimeout(PROCESS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'image/png', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`process ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ---- R2 PUT (SigV4) ----

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256HexBytes(data: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

async function sha256HexString(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(data)));
}

function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function r2PutPng(key: string, body: Uint8Array): Promise<string> {
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKey = Deno.env.get('R2_ACCESS_KEY_ID');
  const secret = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucket = Deno.env.get('R2_BUCKET');
  const region = Deno.env.get('R2_REGION') ?? 'auto';
  if (!accountId || !accessKey || !secret || !bucket) throw new Error('R2 credentials missing');

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/${bucket}/${key.split('/').map(rfc3986).join('/')}`;
  const payloadHash = await sha256HexBytes(body);
  const canonicalHeaders = `content-type:image/png\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256HexString(canonicalRequest)].join('\n');

  const kDate = await hmac(enc.encode(`AWS4${secret}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, 's3');
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetchWithTimeout(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'content-type': 'image/png',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
    },
    body,
  });
  if (!res.ok) throw new Error(`r2 PUT ${res.status} ${await res.text()}`);

  const publicBase = Deno.env.get('R2_PUBLIC_BASE');
  return publicBase ? `${publicBase.replace(/\/+$/, '')}/${key}` : `r2://${bucket}/${key}`;
}

// ---- Main ----

Deno.serve(instrument('ndvi-puller', async () => {
  const supabase = getServiceClient();

  const { data: fieldsRaw, error: fieldsErr } = await supabase
    .from('fields')
    .select('id, geometry, block_id');
  if (fieldsErr) return jsonResponse({ error: fieldsErr.message }, 500);
  const fields = (fieldsRaw ?? []) as FieldRow[];

  const { data: plansRaw } = await supabase
    .from('crop_plans')
    .select('id, field_id')
    .in('current_stage', ['sowing', 'vegetative', 'flowering', 'maturation', 'harvest']);
  const planByField = new Map<string, string>();
  for (const p of (plansRaw ?? []) as ActiveCropPlanRow[]) {
    if (!planByField.has(p.field_id)) planByField.set(p.field_id, p.id);
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Fields that already have an obs in the window so we can short-circuit.
  const fieldIds = fields.map((f) => f.id);
  const { data: existingRaw } = await supabase
    .from('ndvi_observations')
    .select('field_id, observed_on')
    .gte('observed_on', from)
    .in('field_id', fieldIds);
  const existing = new Set<string>(
    ((existingRaw ?? []) as ExistingRow[]).map((r) => `${r.field_id}|${r.observed_on}`),
  );

  let inserts = 0;
  let skipped = 0;
  let errors = 0;
  const token = await getAccessToken();

  for (const f of fields) {
    if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) {
      skipped += 1;
      continue;
    }
    try {
      const buckets = await pullStats(token, f.geometry, from, todayIso);
      const clean = buckets
        .filter((b) => b.pixelsCount > 0)
        .filter((b) => b.cloudCoverPct === null || b.cloudCoverPct <= CLOUD_COVER_LIMIT)
        .sort((a, b) => (a.cloudCoverPct ?? 0) - (b.cloudCoverPct ?? 0));
      const best = clean[0];
      if (!best) {
        skipped += 1;
        continue;
      }
      if (existing.has(`${f.id}|${best.observedOn}`)) {
        skipped += 1;
        continue;
      }

      let previewUrl: string | null = null;
      try {
        const png = await pullPreviewPng(token, f.geometry, best.observedOn);
        const key = `ndvi/${f.id}/${best.observedOn}.png`;
        previewUrl = await r2PutPng(key, png);
      } catch (err) {
        console.warn(`ndvi preview failed for ${f.id} on ${best.observedOn}:`, err);
      }

      const { error: insErr } = await supabase.from('ndvi_observations').insert({
        field_id: f.id,
        crop_plan_id: planByField.get(f.id) ?? null,
        observed_on: best.observedOn,
        satellite: 'sentinel-2',
        cloud_cover_pct: best.cloudCoverPct,
        mean_ndvi: best.meanNdvi,
        min_ndvi: best.minNdvi,
        max_ndvi: best.maxNdvi,
        std_ndvi: best.stDevNdvi,
        pixels_count: best.pixelsCount,
        raw_response: best.raw,
        preview_image_url: previewUrl,
      });
      if (insErr) {
        // Unique-violation on a concurrent run is fine; treat as skip.
        if (insErr.code === '23505') {
          skipped += 1;
        } else {
          console.error(`ndvi insert failed for ${f.id}:`, insErr);
          errors += 1;
        }
        continue;
      }
      inserts += 1;
    } catch (err) {
      console.error(`ndvi pull failed for ${f.id}:`, err);
      errors += 1;
    }
  }

  return jsonResponse({ inserts, skipped, errors, fields: fields.length });
}));
