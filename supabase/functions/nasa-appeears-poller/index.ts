// nasa-appeears-poller
// Schedule: pg_cron weekly Tuesday 01:00 UTC (06:00 PKT). MODIS 16-day NDVI
// (MOD13Q1) gives daily-cadence coverage at 250m which fills the gaps when
// Sentinel-2 is clouded out. SMAP (SPL3SMP_E) gives daily 9km L-band soil
// moisture. AppEEARS uses an async task model; the call is slow but free.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const APPEEARS_BASE = 'https://appeears.earthdatacloud.nasa.gov/api';
const REQUEST_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 8_000;
const MAX_POLL_ATTEMPTS = 60;
const WINDOW_DAYS = 32;

interface FieldRow {
  id: string;
  geometry: { type: string; coordinates: unknown } | null;
}

interface CropPlanRow {
  id: string;
  field_id: string;
}

interface LoginResponse {
  token?: string;
}

interface TaskStatusResponse {
  status?: string;
  task_id?: string;
}

interface BundleFile {
  file_id: string;
  file_name: string;
}

interface BundleResponse {
  files?: BundleFile[];
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

function polygonCentroid(geom: FieldRow['geometry']): { lat: number; lng: number } | null {
  if (!geom) return null;
  const rings =
    geom.type === 'Polygon'
      ? (geom.coordinates as number[][][])
      : (geom.coordinates as number[][][][]).flat();
  if (rings.length === 0 || rings[0].length === 0) return null;
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (const [x, y] of rings[0]) {
    sx += x;
    sy += y;
    count += 1;
  }
  if (count === 0) return null;
  return { lat: sy / count, lng: sx / count };
}

function mmDdYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
}

async function login(): Promise<string | null> {
  const user = Deno.env.get('NASA_EARTHDATA_USER');
  const pass = Deno.env.get('NASA_EARTHDATA_PASS');
  if (!user || !pass) return null;
  const encoded = btoa(`${user}:${pass}`);
  const res = await fetchWithTimeout(`${APPEEARS_BASE}/login`, {
    method: 'POST',
    headers: { authorization: `Basic ${encoded}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as LoginResponse;
  return json.token ?? null;
}

interface SubmitArgs {
  token: string;
  product: string;
  valueLayer: string;
  qualityLayer: string;
  lat: number;
  lng: number;
  fromDate: string;
  toDate: string;
  taskName: string;
}

async function submitTask(args: SubmitArgs): Promise<string | null> {
  const payload = {
    task_type: 'point',
    task_name: args.taskName,
    params: {
      dates: [{ startDate: mmDdYyyy(args.fromDate), endDate: mmDdYyyy(args.toDate) }],
      layers: [
        { product: args.product, layer: args.valueLayer },
        { product: args.product, layer: args.qualityLayer },
      ],
      coordinates: [{ latitude: args.lat, longitude: args.lng, id: 'point', category: 'field' }],
    },
  };
  const res = await fetchWithTimeout(`${APPEEARS_BASE}/task`, {
    method: 'POST',
    headers: { authorization: `Bearer ${args.token}`, 'content-type': 'application/json' },
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
      if (json.status === 'error' || json.status === 'expired' || json.status === 'cancelled') {
        return false;
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function downloadCsv(token: string, taskId: string): Promise<string | null> {
  const res = await fetchWithTimeout(`${APPEEARS_BASE}/bundle/${taskId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const bundle = (await res.json()) as BundleResponse;
  const csv = (bundle.files ?? []).find((f) => f.file_name?.toLowerCase().endsWith('.csv'));
  if (!csv) return null;
  const file = await fetchWithTimeout(`${APPEEARS_BASE}/bundle/${taskId}/${csv.file_id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!file.ok) return null;
  return await file.text();
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = (cols[j] ?? '').trim();
    out.push(row);
  }
  return out;
}

function findCol(headers: string[], needles: string[]): string | undefined {
  for (const h of headers) {
    const hl = h.toLowerCase();
    if (needles.some((n) => hl.includes(n))) return h;
  }
  return undefined;
}

function classifyModisQuality(qa: number): 'good' | 'moderate' | 'poor' {
  if (!Number.isFinite(qa)) return 'poor';
  const bits = qa & 0b11;
  if (bits === 0) return 'good';
  if (bits === 1) return 'moderate';
  return 'poor';
}

Deno.serve(
  instrument('nasa-appeears-poller', async () => {
    const token = await login();
    if (!token) {
      return jsonResponse({ skipped: true, reason: 'NASA Earthdata credentials missing' });
    }

    const supabase = getServiceClient();

    const { data: fieldsRaw, error: fieldsErr } = await supabase
      .from('fields')
      .select('id, geometry');
    if (fieldsErr) return jsonResponse({ error: fieldsErr.message }, 500);
    const fields = (fieldsRaw ?? []) as FieldRow[];

    const { data: plansRaw } = await supabase
      .from('crop_plans')
      .select('id, field_id')
      .in('current_stage', ['sowing', 'vegetative', 'flowering', 'maturation', 'harvest']);
    const planByField = new Map<string, string>();
    for (const p of (plansRaw ?? []) as CropPlanRow[]) {
      if (!planByField.has(p.field_id)) planByField.set(p.field_id, p.id);
    }

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const fromIso = new Date(today.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    let modisInserts = 0;
    let smapInserts = 0;
    let errors = 0;

    for (const field of fields) {
      const centroid = polygonCentroid(field.geometry);
      if (!centroid) continue;

      // ---- MODIS NDVI ----
      try {
        const taskId = await submitTask({
          token,
          product: 'MOD13Q1.061',
          valueLayer: '_250m_16_days_NDVI',
          qualityLayer: '_250m_16_days_VI_Quality',
          lat: centroid.lat,
          lng: centroid.lng,
          fromDate: fromIso,
          toDate: todayIso,
          taskName: `zameen-modis-${field.id.slice(0, 8)}`,
        });
        if (taskId && (await waitForTask(token, taskId))) {
          const csv = await downloadCsv(token, taskId);
          if (csv) {
            const rows = parseCsv(csv);
            if (rows.length > 0) {
              const headers = Object.keys(rows[0]);
              const dateCol = findCol(headers, ['date']) ?? 'Date';
              const ndviCol = findCol(headers, ['ndvi']);
              const qaCol = findCol(headers, ['vi_quality', 'quality']);
              if (ndviCol) {
                for (const row of rows) {
                  const rawDate = row[dateCol];
                  const rawNdvi = Number.parseFloat(row[ndviCol] ?? '');
                  if (!rawDate || !Number.isFinite(rawNdvi)) continue;
                  const scaled = Math.abs(rawNdvi) > 1.5 ? rawNdvi / 10000 : rawNdvi;
                  const qa = qaCol ? Number.parseInt(row[qaCol] ?? '', 10) : NaN;
                  const cloudHint =
                    classifyModisQuality(qa) === 'good'
                      ? 0
                      : classifyModisQuality(qa) === 'moderate'
                      ? 25
                      : 60;
                  const { error: insErr } = await supabase.from('ndvi_observations').insert({
                    field_id: field.id,
                    crop_plan_id: planByField.get(field.id) ?? null,
                    observed_on: rawDate.slice(0, 10),
                    satellite: 'modis',
                    cloud_cover_pct: cloudHint,
                    mean_ndvi: Math.max(-1, Math.min(1, scaled)),
                    pixels_count: 1,
                    raw_response: row,
                  });
                  if (!insErr) modisInserts += 1;
                  else if (insErr.code !== '23505') errors += 1;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('modis fail', field.id, err);
        errors += 1;
      }

      // ---- SMAP soil moisture ----
      try {
        const taskId = await submitTask({
          token,
          product: 'SPL3SMP_E.005',
          valueLayer: 'Soil_Moisture_Retrieval_Data_AM_soil_moisture',
          qualityLayer: 'Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag',
          lat: centroid.lat,
          lng: centroid.lng,
          fromDate: fromIso,
          toDate: todayIso,
          taskName: `zameen-smap-${field.id.slice(0, 8)}`,
        });
        if (taskId && (await waitForTask(token, taskId))) {
          const csv = await downloadCsv(token, taskId);
          if (csv) {
            const rows = parseCsv(csv);
            if (rows.length > 0) {
              const headers = Object.keys(rows[0]);
              const dateCol = findCol(headers, ['date']) ?? 'Date';
              const smCol = findCol(headers, ['soil_moisture']);
              const qualCol = findCol(headers, ['qual_flag', 'quality']);
              if (smCol) {
                for (const row of rows) {
                  const rawDate = row[dateCol];
                  const sm = Number.parseFloat(row[smCol] ?? '');
                  if (!rawDate || !Number.isFinite(sm) || sm < 0 || sm > 1) continue;
                  const qa = qualCol ? Number.parseFloat(row[qualCol] ?? '') : 1;
                  const { error: insErr } = await supabase.from('smap_observations').insert({
                    field_id: field.id,
                    observed_on: rawDate.slice(0, 10),
                    soil_moisture_m3m3: sm,
                    retrieval_quality: Number.isFinite(qa) ? qa : 1,
                    source: 'smap',
                  });
                  if (!insErr) smapInserts += 1;
                  else if (insErr.code !== '23505') errors += 1;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('smap fail', field.id, err);
        errors += 1;
      }
    }

    return jsonResponse({ modisInserts, smapInserts, errors, fields: fields.length });
  }),
);
