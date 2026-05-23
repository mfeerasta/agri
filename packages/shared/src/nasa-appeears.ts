/**
 * NASA AppEEARS client for MODIS NDVI (MOD13Q1) and SMAP soil moisture
 * (SPL3SMP_E). Free with NASA Earthdata Login credentials.
 *
 * AppEEARS uses an async task-submit / poll / download model:
 *   POST /api/login                 (basic auth -> token)
 *   POST /api/task                  (submit point sample task)
 *   GET  /api/task/{task_id}        (poll until status === 'done')
 *   GET  /api/bundle/{task_id}      (list files)
 *   GET  /api/bundle/{task_id}/{file_id}  (download CSV)
 *
 * Credentials env:
 *   NASA_EARTHDATA_USER
 *   NASA_EARTHDATA_PASS
 *
 * If credentials are missing, the functions return empty arrays so cron does
 * not crash. Calls have a 60s base timeout because AppEEARS is slow.
 */

const APPEEARS_BASE = 'https://appeears.earthdatacloud.nasa.gov/api';
const REQUEST_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 8_000;
const MAX_POLL_ATTEMPTS = 60;

export interface ModisNdviPoint {
  date: string;
  ndvi: number;
  quality: 'good' | 'moderate' | 'poor';
}

export interface SmapSoilMoisturePoint {
  date: string;
  soilMoistureM3M3: number;
  retrievalQuality: number;
}

interface PointArgs {
  lat: number;
  lng: number;
  fromDate: string;
  toDate: string;
}

function readEnv(name: string): string | undefined {
  const node = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (node?.env && node.env[name]) return node.env[name];
  const deno = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno;
  return deno?.env?.get?.(name);
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface LoginResponse {
  token?: string;
  expiration?: string;
}

interface TaskStatusResponse {
  status?: string;
  task_id?: string;
}

interface BundleFile {
  file_id: string;
  file_name: string;
  file_type?: string;
}

interface BundleResponse {
  files?: BundleFile[];
}

async function login(): Promise<string | null> {
  const user = readEnv('NASA_EARTHDATA_USER');
  const pass = readEnv('NASA_EARTHDATA_PASS');
  if (!user || !pass) return null;
  const basic = `${user}:${pass}`;
  // btoa exists in Deno and Node 18+.
  const encoded =
    typeof btoa === 'function'
      ? btoa(basic)
      : Buffer.from(basic, 'utf-8').toString('base64');
  const res = await fetchWithTimeout(`${APPEEARS_BASE}/login`, {
    method: 'POST',
    headers: { authorization: `Basic ${encoded}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as LoginResponse;
  return json.token ?? null;
}

function mmDdYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
}

interface SubmitTaskArgs {
  token: string;
  productLayer: { product: string; layer: string };
  qualityLayer?: { product: string; layer: string };
  lat: number;
  lng: number;
  fromDate: string;
  toDate: string;
  taskName: string;
}

async function submitTask(args: SubmitTaskArgs): Promise<string | null> {
  const layers = [
    { product: args.productLayer.product, layer: args.productLayer.layer },
  ];
  if (args.qualityLayer) layers.push(args.qualityLayer);

  const payload = {
    task_type: 'point',
    task_name: args.taskName,
    params: {
      dates: [{ startDate: mmDdYyyy(args.fromDate), endDate: mmDdYyyy(args.toDate) }],
      layers,
      coordinates: [{ latitude: args.lat, longitude: args.lng, id: 'farm', category: 'point' }],
    },
  };
  const res = await fetchWithTimeout(`${APPEEARS_BASE}/task`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${args.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as TaskStatusResponse;
  return json.task_id ?? null;
}

async function waitForTask(token: string, taskId: string): Promise<boolean> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const res = await fetchWithTimeout(`${APPEEARS_BASE}/task/${taskId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = (await res.json()) as TaskStatusResponse;
      if (json.status === 'done') return true;
      if (json.status === 'expired' || json.status === 'error' || json.status === 'cancelled') {
        return false;
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function listBundleCsv(token: string, taskId: string): Promise<BundleFile | null> {
  const res = await fetchWithTimeout(`${APPEEARS_BASE}/bundle/${taskId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as BundleResponse;
  const csv = (json.files ?? []).find((f) => f.file_name?.toLowerCase().endsWith('.csv'));
  return csv ?? null;
}

async function downloadCsv(token: string, taskId: string, fileId: string): Promise<string | null> {
  const res = await fetchWithTimeout(`${APPEEARS_BASE}/bundle/${taskId}/${fileId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.text();
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = (cols[j] ?? '').trim();
    }
    out.push(row);
  }
  return out;
}

function findColumn(headers: string[], needles: string[]): string | undefined {
  for (const h of headers) {
    const hl = h.toLowerCase();
    if (needles.some((n) => hl.includes(n))) return h;
  }
  return undefined;
}

function classifyModisQuality(qaValue: number): 'good' | 'moderate' | 'poor' {
  if (!Number.isFinite(qaValue)) return 'poor';
  // MOD13Q1 VI Quality bits 0-1: 00 good, 01 marginal, others poor.
  const bits = qaValue & 0b11;
  if (bits === 0) return 'good';
  if (bits === 1) return 'moderate';
  return 'poor';
}

export async function fetchModisNdvi(args: PointArgs): Promise<ModisNdviPoint[]> {
  const token = await login();
  if (!token) return [];

  const taskId = await submitTask({
    token,
    productLayer: { product: 'MOD13Q1.061', layer: '_250m_16_days_NDVI' },
    qualityLayer: { product: 'MOD13Q1.061', layer: '_250m_16_days_VI_Quality' },
    lat: args.lat,
    lng: args.lng,
    fromDate: args.fromDate,
    toDate: args.toDate,
    taskName: `zameen-modis-${Date.now()}`,
  });
  if (!taskId) return [];
  const done = await waitForTask(token, taskId);
  if (!done) return [];
  const csv = await listBundleCsv(token, taskId);
  if (!csv) return [];
  const text = await downloadCsv(token, taskId, csv.file_id);
  if (!text) return [];

  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const dateCol = findColumn(headers, ['date']) ?? 'Date';
  const ndviCol = findColumn(headers, ['ndvi']);
  const qaCol = findColumn(headers, ['vi_quality', 'quality']);
  if (!ndviCol) return [];

  const out: ModisNdviPoint[] = [];
  for (const row of rows) {
    const rawDate = row[dateCol];
    const rawNdvi = Number.parseFloat(row[ndviCol] ?? '');
    if (!rawDate || !Number.isFinite(rawNdvi)) continue;
    // MOD13Q1 NDVI is stored scaled by 10000.
    const scaled = Math.abs(rawNdvi) > 1.5 ? rawNdvi / 10000 : rawNdvi;
    if (!Number.isFinite(scaled)) continue;
    const qa = qaCol ? Number.parseInt(row[qaCol] ?? '', 10) : NaN;
    out.push({
      date: rawDate.slice(0, 10),
      ndvi: Math.max(-1, Math.min(1, scaled)),
      quality: classifyModisQuality(qa),
    });
  }
  return out;
}

export async function fetchSmapSoilMoisture(args: PointArgs): Promise<SmapSoilMoisturePoint[]> {
  const token = await login();
  if (!token) return [];

  const taskId = await submitTask({
    token,
    productLayer: { product: 'SPL3SMP_E.005', layer: 'Soil_Moisture_Retrieval_Data_AM_soil_moisture' },
    qualityLayer: {
      product: 'SPL3SMP_E.005',
      layer: 'Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag',
    },
    lat: args.lat,
    lng: args.lng,
    fromDate: args.fromDate,
    toDate: args.toDate,
    taskName: `zameen-smap-${Date.now()}`,
  });
  if (!taskId) return [];
  const done = await waitForTask(token, taskId);
  if (!done) return [];
  const csv = await listBundleCsv(token, taskId);
  if (!csv) return [];
  const text = await downloadCsv(token, taskId, csv.file_id);
  if (!text) return [];

  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const dateCol = findColumn(headers, ['date']) ?? 'Date';
  const smCol = findColumn(headers, ['soil_moisture']);
  const qualCol = findColumn(headers, ['qual_flag', 'quality']);
  if (!smCol) return [];

  const out: SmapSoilMoisturePoint[] = [];
  for (const row of rows) {
    const rawDate = row[dateCol];
    const rawSm = Number.parseFloat(row[smCol] ?? '');
    if (!rawDate || !Number.isFinite(rawSm) || rawSm < 0 || rawSm > 1) continue;
    const qa = qualCol ? Number.parseFloat(row[qualCol] ?? '') : 1;
    out.push({
      date: rawDate.slice(0, 10),
      soilMoistureM3M3: rawSm,
      retrievalQuality: Number.isFinite(qa) ? qa : 1,
    });
  }
  return out;
}
