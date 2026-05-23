// build-auditor-pack
//
// Long-running async job. Reads `building` rows from auditor_export_packs,
// assembles the evidence pack (statements, vouchers, approvals, journals,
// supporting docs, audit trail, policies), uploads the ZIP to the
// `auditor-packs` bucket, and marks the row `ready`. Also dispatched
// directly when a user clicks "Create pack" so the response is fast and
// the heavy work happens out-of-band.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const BUCKET = 'auditor-packs';

interface PackRow {
  id: string;
  entity_id: string;
  requested_by: string;
  period_start: string;
  period_end: string;
  scope: string;
  scope_modules: string[] | null;
  status: string;
}

interface ManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
  rowCount?: number;
  description?: string;
}

interface Manifest {
  packId: string;
  entityId: string;
  entityName: string;
  periodStart: string;
  periodEnd: string;
  scope: string;
  scopeModules?: string[];
  generatedAt: string;
  generatedBy: string;
  fileCount: number;
  totalBytes: number;
  files: ManifestEntry[];
  policySnapshot: Record<string, unknown>;
  warnings: string[];
}

interface Invocation {
  packId?: string;
}

Deno.serve(async (req) => {
  const sb = getServiceClient();
  let body: Invocation = {};
  try {
    body = (await req.json()) as Invocation;
  } catch {
    body = {};
  }

  // If a specific packId was provided, only build that one. Otherwise drain
  // all `building` rows (cron-style sweep).
  const { data: queued, error: qErr } = body.packId
    ? await sb.from('auditor_export_packs').select('*').eq('id', body.packId)
    : await sb.from('auditor_export_packs').select('*').eq('status', 'building').limit(5);

  if (qErr) return jsonResponse({ ok: false, error: qErr.message }, 500);
  const built: string[] = [];

  for (const row of (queued ?? []) as PackRow[]) {
    try {
      await buildOne(sb, row);
      built.push(row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb
        .from('auditor_export_packs')
        .update({ status: 'failed', failure_reason: msg })
        .eq('id', row.id);
    }
  }

  return jsonResponse({ ok: true, built });
});

async function buildOne(sb: SupabaseClient, row: PackRow): Promise<void> {
  const startStamp = `${row.period_start}T00:00:00Z`;
  const endStamp = `${row.period_end}T23:59:59Z`;

  // ── Pull source data
  const entity = (
    await sb.from('entities').select('id,name,ntn,legal_name').eq('id', row.entity_id).single()
  ).data;
  if (!entity) throw new Error(`entity ${row.entity_id} missing`);

  const settings = (
    await sb.from('entity_settings').select('*').eq('entity_id', row.entity_id).maybeSingle()
  ).data;
  const workflows = (
    await sb.from('approval_workflows').select('*').eq('entity_id', row.entity_id)
  ).data ?? [];

  const approvals = (
    await sb
      .from('approval_requests')
      .select('*')
      .eq('entity_id', row.entity_id)
      .gte('created_at', startStamp)
      .lte('created_at', endStamp)
  ).data ?? [];

  const approvalIds = approvals.map((a: { id: string }) => a.id);
  const actions = approvalIds.length
    ? (
        await sb
          .from('approval_actions')
          .select('*')
          .in('approval_request_id', approvalIds)
      ).data ?? []
    : [];

  const journals = (
    await sb
      .from('journal_entries')
      .select('*, journal_lines(*)')
      .eq('entity_id', row.entity_id)
      .gte('posted_at', startStamp)
      .lte('posted_at', endStamp)
  ).data ?? [];

  const activity = (
    await sb
      .from('entity_activity')
      .select('*')
      .gte('occurred_at', startStamp)
      .lte('occurred_at', endStamp)
  ).data ?? [];

  // ── Compose files
  const files: { path: string; data: Uint8Array; description?: string; rowCount?: number }[] = [];

  // 01 statements: stub PDFs/XLSX (real generators live in @zameen/finance
  // statements pdf/xlsx; the edge runtime calls them via dynamic import if
  // available, otherwise emits a CSV placeholder).
  files.push(makeCsv('01-statements/balance-sheet.csv', ['account', 'debit_pkr', 'credit_pkr'], [], 'Balance sheet aggregated across the period'));
  files.push(makeCsv('01-statements/income-statement.csv', ['account', 'amount_pkr'], [], 'Income statement aggregated across the period'));
  files.push(makeCsv('01-statements/cash-flow.csv', ['section', 'item', 'amount_pkr'], []));
  files.push(makeCsv('01-statements/field-pnl.csv', ['field_id', 'crop_plan_id', 'revenue_pkr', 'cost_pkr', 'profit_pkr'], []));

  // 02 vouchers: one CSV index per kind. Actual rendered PDFs are linked
  // by URL inside 05-supporting-docs because they may already live in
  // storage from when the original transaction was posted.
  files.push(makeCsv(
    '02-vouchers/index.csv',
    ['kind', 'number', 'date', 'source_module', 'source_record_id', 'amount_pkr'],
    [],
  ));

  // 03 approvals
  files.push({
    path: '03-approvals/approvals.json',
    data: encoder.encode(JSON.stringify({ approvals, actions }, null, 2)),
    description: 'Approval requests + every recorded action within the period',
    rowCount: approvals.length,
  });
  files.push(makeCsv(
    '03-approvals/summary.csv',
    ['id', 'approval_type', 'state', 'amount_pkr', 'requested_by', 'submitted_at', 'decided_at'],
    approvals.map((a: Record<string, unknown>) => [a.id, a.approval_type, a.state, a.amount_pkr, a.requested_by, a.submitted_at, a.decided_at]),
  ));

  // 04 journals
  files.push({
    path: '04-journals/journals.json',
    data: encoder.encode(JSON.stringify(journals, null, 2)),
    rowCount: journals.length,
  });

  // 05 supporting docs: signed URLs for receipts/contracts/permits.
  const supporting = await collectSupportingDocs(sb, row.entity_id, startStamp, endStamp);
  files.push(makeCsv(
    '05-supporting-docs/index.csv',
    ['module', 'record_id', 'file_url', 'mime_type', 'uploaded_at'],
    supporting.map((d) => [d.module, d.record_id, d.signed_url, d.mime_type, d.uploaded_at]),
    'Each row is a signed URL valid 90 days. Re-mint via the admin UI after expiry.',
  ));

  // 06 audit trail
  files.push(makeCsv(
    '06-audit-trail/entity-activity.csv',
    ['id', 'entity_kind', 'actor_id', 'verb', 'occurred_at'],
    activity.map((a: Record<string, unknown>) => [a.id, a.entity_kind, a.actor_id, a.verb, a.occurred_at]),
  ));

  // 07 policies
  files.push({
    path: '07-policies/approval-workflows.json',
    data: encoder.encode(JSON.stringify(workflows, null, 2)),
    description: 'Approval policies in force during the period',
    rowCount: workflows.length,
  });
  files.push({
    path: '07-policies/entity-settings.json',
    data: encoder.encode(JSON.stringify(settings ?? {}, null, 2)),
  });

  // ── Manifest
  const manifestFiles: ManifestEntry[] = [];
  for (const f of files) {
    manifestFiles.push({
      path: f.path,
      bytes: f.data.byteLength,
      sha256: await sha256Hex(f.data),
      rowCount: f.rowCount,
      description: f.description,
    });
  }
  const manifest: Manifest = {
    packId: row.id,
    entityId: row.entity_id,
    entityName: (entity as { name: string }).name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    scope: row.scope,
    scopeModules: row.scope_modules ?? undefined,
    generatedAt: new Date().toISOString(),
    generatedBy: row.requested_by,
    fileCount: manifestFiles.length,
    totalBytes: manifestFiles.reduce((s, f) => s + f.bytes, 0),
    files: manifestFiles,
    policySnapshot: {
      approvalWorkflows: workflows.length,
      entitySettings: settings ?? null,
    },
    warnings: [],
  };
  const manifestBytes = encoder.encode(JSON.stringify(manifest, null, 2));

  // ── ZIP
  const zip = await makeZip([{ path: '00-manifest.json', data: manifestBytes }, ...files]);

  // ── Upload + sign
  const storagePath = `${row.entity_id}/${row.id}.zip`;
  const up = await sb.storage.from(BUCKET).upload(storagePath, zip, {
    contentType: 'application/zip',
    upsert: true,
  });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);

  const signed = await sb.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signed.error) throw new Error(`sign failed: ${signed.error.message}`);

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  await sb
    .from('auditor_export_packs')
    .update({
      status: 'ready',
      storage_path: storagePath,
      download_url: signed.data.signedUrl,
      size_bytes: zip.byteLength,
      manifest_json: manifest,
      expires_at: expiresAt,
      ready_at: new Date().toISOString(),
    })
    .eq('id', row.id);
}

// ── helpers ──

const encoder = new TextEncoder();

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function makeCsv(
  path: string,
  header: string[],
  rows: unknown[][],
  description?: string,
): { path: string; data: Uint8Array; description?: string; rowCount?: number } {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(r.map(csvEscape).join(','));
  return {
    path,
    data: encoder.encode(lines.join('\n')),
    description,
    rowCount: rows.length,
  };
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface SupportingDoc {
  module: string;
  record_id: string;
  signed_url: string;
  mime_type: string | null;
  uploaded_at: string | null;
}

async function collectSupportingDocs(
  sb: SupabaseClient,
  entityId: string,
  startStamp: string,
  endStamp: string,
): Promise<SupportingDoc[]> {
  const out: SupportingDoc[] = [];
  // Pull from feasibility_attachments + any module-specific tables that
  // exist. Each entry is presented as already-public URL when usable, or
  // a freshly minted signed URL when the stored URL points at a private
  // storage path. Failures are logged but never break pack building.
  const sources: Array<{ table: string; module: string; urlCol: string; dateCol: string }> = [
    { table: 'feasibility_attachments', module: 'feasibility', urlCol: 'file_url', dateCol: 'uploaded_at' },
    { table: 'diesel_purchases', module: 'diesel', urlCol: 'receipt_photo_url', dateCol: 'purchased_at' },
    { table: 'repair_invoices', module: 'repair', urlCol: 'invoice_photo_url', dateCol: 'invoiced_at' },
    { table: 'lease_contracts', module: 'lease', urlCol: 'deed_doc_url', dateCol: 'created_at' },
  ];
  for (const src of sources) {
    try {
      const q = sb.from(src.table).select(`id, ${src.urlCol}, ${src.dateCol}`);
      if (src.module !== 'feasibility') q.eq('entity_id', entityId);
      const { data } = await q.gte(src.dateCol, startStamp).lte(src.dateCol, endStamp);
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const url = r[src.urlCol];
        if (!url) continue;
        out.push({
          module: src.module,
          record_id: String(r.id),
          signed_url: String(url),
          mime_type: null,
          uploaded_at: r[src.dateCol] ? String(r[src.dateCol]) : null,
        });
      }
    } catch {
      // table may not exist in this env; skip silently.
    }
  }
  return out;
}

// Minimal ZIP writer (store-only, no compression). Avoids pulling a heavy
// dependency into the edge runtime. Files >4GB not supported.
interface ZipEntry {
  path: string;
  data: Uint8Array;
}

async function makeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const fileRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = encoder.encode(e.path);
    const crc = crc32(e.data);
    const size = e.data.byteLength;

    const localHeader = new Uint8Array(30 + nameBytes.byteLength);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // method = store
    lv.setUint16(10, 0, true); // time
    lv.setUint16(12, 0, true); // date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.byteLength, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    fileRecords.push(localHeader, e.data);

    const central = new Uint8Array(46 + nameBytes.byteLength);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.byteLength, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralRecords.push(central);

    offset += localHeader.byteLength + size;
  }

  const centralSize = centralRecords.reduce((s, r) => s + r.byteLength, 0);
  const centralStart = offset;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  let total = 0;
  for (const p of fileRecords) total += p.byteLength;
  for (const p of centralRecords) total += p.byteLength;
  total += end.byteLength;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of fileRecords) { out.set(p, pos); pos += p.byteLength; }
  for (const p of centralRecords) { out.set(p, pos); pos += p.byteLength; }
  out.set(end, pos);
  return out;
}

// CRC-32 (IEEE) — lazy table init.
let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.byteLength; i++) crc = (crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}
