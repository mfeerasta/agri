'use client';
import { get, set, del, keys } from 'idb-keyval';

export interface QueuedOp {
  id: string;
  resource: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  idempotencyKey: string;
  priority: 'critical' | 'normal' | 'low';
  clientCreatedAt: string;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
}

export interface PendingPhoto {
  id: string;
  blob: Blob;
  contentType: string;
  targetResource: string;
  targetField: string;
  targetRecordId?: string;
  idempotencyKey: string;
  clientCreatedAt: string;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
}

export interface QueueStats {
  pending: number;
  failed: number;
  processing: number;
  oldestPendingAt: Date | null;
}

export interface DrainResult {
  succeeded: number;
  failed: number;
  pending: number;
  lastResults: Array<{ id: string; resource: string; ok: boolean; error?: string }>;
}

export interface QueueSnapshot {
  pendingCount: number;
  processingCount: number;
  lastDrainedAt: string | null;
  lastError: string | null;
}

type Subscriber = (snap: QueueSnapshot) => void;

const Q_PREFIX = 'queue:';
const P_PREFIX = 'photo:';
const BACKOFF_MS = [5_000, 30_000, 5 * 60_000, 30 * 60_000, 4 * 60 * 60_000];
const MAX_ATTEMPTS = BACKOFF_MS.length;

let processingCount = 0;
let lastDrainedAt: string | null = null;
let lastError: string | null = null;
const subscribers = new Set<Subscriber>();

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function emit(): Promise<void> {
  const [q, p] = await Promise.all([listQueue(), listPhotos()]);
  const snap: QueueSnapshot = {
    pendingCount: q.length + p.length,
    processingCount,
    lastDrainedAt,
    lastError,
  };
  for (const s of subscribers) {
    try {
      s(snap);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function subscribeToQueue(cb: Subscriber): () => void {
  subscribers.add(cb);
  void emit();
  return () => {
    subscribers.delete(cb);
  };
}

export async function getQueueStats(): Promise<QueueStats> {
  const [q, p] = await Promise.all([listQueue(), listPhotos()]);
  const all = [...q, ...p];
  const now = Date.now();
  let failed = 0;
  let pending = 0;
  let oldest: number | null = null;
  for (const r of all) {
    if (r.attempts >= MAX_ATTEMPTS) {
      failed += 1;
    } else {
      pending += 1;
    }
    const created = new Date(r.clientCreatedAt).getTime();
    if (oldest === null || created < oldest) oldest = created;
  }
  return {
    pending,
    failed,
    processing: processingCount,
    oldestPendingAt: oldest === null ? null : new Date(oldest),
  };
}

function nextBackoff(attempts: number): string | undefined {
  if (attempts >= MAX_ATTEMPTS) return undefined;
  const wait = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
  return new Date(Date.now() + wait).toISOString();
}

function isReady(r: { attempts: number; nextRetryAt?: string }): boolean {
  if (r.attempts >= MAX_ATTEMPTS) return false;
  if (!r.nextRetryAt) return true;
  return new Date(r.nextRetryAt).getTime() <= Date.now();
}

export async function enqueue(
  op: Omit<QueuedOp, 'id' | 'attempts' | 'clientCreatedAt' | 'idempotencyKey' | 'priority'> & {
    idempotencyKey?: string;
    priority?: QueuedOp['priority'];
  },
): Promise<string> {
  const id = newId();
  const record: QueuedOp = {
    id,
    attempts: 0,
    clientCreatedAt: new Date().toISOString(),
    idempotencyKey: op.idempotencyKey ?? uuid(),
    priority: op.priority ?? 'normal',
    resource: op.resource,
    operation: op.operation,
    payload: op.payload,
  };
  await set(Q_PREFIX + id, record);
  void emit();
  void requestBackgroundSync();
  return record.idempotencyKey;
}

export async function listQueue(): Promise<QueuedOp[]> {
  const ks = await keys();
  const out: QueuedOp[] = [];
  for (const k of ks) {
    if (typeof k === 'string' && k.startsWith(Q_PREFIX)) {
      const v = (await get(k)) as QueuedOp | undefined;
      if (v) out.push(v);
    }
  }
  return out.sort((a, b) => {
    const order = { critical: 0, normal: 1, low: 2 } as const;
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    return a.clientCreatedAt.localeCompare(b.clientCreatedAt);
  });
}

export async function ack(id: string): Promise<void> {
  await del(Q_PREFIX + id);
  void emit();
}

export async function bumpAttempt(id: string, errMessage?: string): Promise<void> {
  const r = (await get(Q_PREFIX + id)) as QueuedOp | undefined;
  if (!r) return;
  const attempts = r.attempts + 1;
  await set(Q_PREFIX + id, {
    ...r,
    attempts,
    lastError: errMessage,
    nextRetryAt: nextBackoff(attempts),
  });
  void emit();
}

export async function enqueuePhoto(
  p: Omit<PendingPhoto, 'id' | 'attempts' | 'clientCreatedAt' | 'idempotencyKey'> & { idempotencyKey?: string },
): Promise<string> {
  const id = newId();
  const rec: PendingPhoto = {
    id,
    attempts: 0,
    clientCreatedAt: new Date().toISOString(),
    idempotencyKey: p.idempotencyKey ?? uuid(),
    blob: p.blob,
    contentType: p.contentType,
    targetResource: p.targetResource,
    targetField: p.targetField,
    targetRecordId: p.targetRecordId,
  };
  await set(P_PREFIX + id, rec);
  void emit();
  void requestBackgroundSync();
  return id;
}

export async function listPhotos(): Promise<PendingPhoto[]> {
  const ks = await keys();
  const out: PendingPhoto[] = [];
  for (const k of ks) {
    if (typeof k === 'string' && k.startsWith(P_PREFIX)) {
      const v = (await get(k)) as PendingPhoto | undefined;
      if (v) out.push(v);
    }
  }
  return out.sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
}

export async function ackPhoto(id: string): Promise<void> {
  await del(P_PREFIX + id);
  void emit();
}

export async function bumpPhoto(id: string, errMessage?: string): Promise<void> {
  const r = (await get(P_PREFIX + id)) as PendingPhoto | undefined;
  if (!r) return;
  const attempts = r.attempts + 1;
  await set(P_PREFIX + id, {
    ...r,
    attempts,
    lastError: errMessage,
    nextRetryAt: nextBackoff(attempts),
  });
  void emit();
}

export async function dismissOp(id: string): Promise<void> {
  await del(Q_PREFIX + id);
  await del(P_PREFIX + id);
  void emit();
}

export async function retryNow(id: string): Promise<void> {
  const q = (await get(Q_PREFIX + id)) as QueuedOp | undefined;
  if (q) {
    await set(Q_PREFIX + id, { ...q, attempts: 0, nextRetryAt: undefined, lastError: undefined });
    void emit();
    return;
  }
  const p = (await get(P_PREFIX + id)) as PendingPhoto | undefined;
  if (p) {
    await set(P_PREFIX + id, { ...p, attempts: 0, nextRetryAt: undefined, lastError: undefined });
    void emit();
  }
}

export async function retryFailed(): Promise<void> {
  const [qs, ps] = await Promise.all([listQueue(), listPhotos()]);
  for (const q of qs) {
    if (q.attempts >= MAX_ATTEMPTS) {
      await set(Q_PREFIX + q.id, { ...q, attempts: 0, nextRetryAt: undefined, lastError: undefined });
    }
  }
  for (const p of ps) {
    if (p.attempts >= MAX_ATTEMPTS) {
      await set(P_PREFIX + p.id, { ...p, attempts: 0, nextRetryAt: undefined, lastError: undefined });
    }
  }
  void emit();
}

export async function clearFailed(): Promise<void> {
  const [qs, ps] = await Promise.all([listQueue(), listPhotos()]);
  for (const q of qs) {
    if (q.attempts >= MAX_ATTEMPTS) await del(Q_PREFIX + q.id);
  }
  for (const p of ps) {
    if (p.attempts >= MAX_ATTEMPTS) await del(P_PREFIX + p.id);
  }
  void emit();
}

export async function exportQueueJson(): Promise<string> {
  const [qs, ps] = await Promise.all([listQueue(), listPhotos()]);
  const photoMeta = ps.map((p) => ({
    id: p.id,
    targetResource: p.targetResource,
    targetField: p.targetField,
    targetRecordId: p.targetRecordId,
    idempotencyKey: p.idempotencyKey,
    clientCreatedAt: p.clientCreatedAt,
    attempts: p.attempts,
    lastError: p.lastError,
    nextRetryAt: p.nextRetryAt,
    contentType: p.contentType,
    blobSizeBytes: p.blob.size,
  }));
  return JSON.stringify({ ops: qs, photos: photoMeta, exportedAt: new Date().toISOString() }, null, 2);
}

interface BatteryManager {
  level: number;
  charging: boolean;
}
async function getBatteryLevel(): Promise<number | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
  if (typeof nav.getBattery !== 'function') return null;
  try {
    const b = await nav.getBattery();
    return b.charging ? 1 : b.level;
  } catch {
    return null;
  }
}

async function uploadPhoto(p: PendingPhoto): Promise<{ ok: boolean; error?: string }> {
  try {
    const presignRes = await fetch('/api/uploads/r2-presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contentType: p.contentType, prefix: p.targetResource }),
    });
    if (!presignRes.ok) return { ok: false, error: `presign ${presignRes.status}` };
    const { uploadUrl, publicUrl } = (await presignRes.json()) as {
      uploadUrl: string;
      publicUrl: string;
    };
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': p.contentType },
      body: p.blob,
    });
    if (!putRes.ok) return { ok: false, error: `put ${putRes.status}` };
    const attachRes = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        resource: p.targetResource,
        operation: 'attach_photo',
        idempotencyKey: p.idempotencyKey,
        payload: {
          targetField: p.targetField,
          targetRecordId: p.targetRecordId,
          url: publicUrl,
        },
      }),
    });
    if (!attachRes.ok) return { ok: false, error: `attach ${attachRes.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (reg.sync) {
      await reg.sync.register('zameen-drain-queue');
    }
  } catch {
    // not supported (e.g. iOS Safari); silently skip
  }
}

export async function drainNow(endpoint = '/api/sync'): Promise<DrainResult> {
  return drain(endpoint);
}

export async function drain(endpoint = '/api/sync'): Promise<DrainResult> {
  processingCount += 1;
  void emit();
  const lastResults: DrainResult['lastResults'] = [];
  try {
    const battery = await getBatteryLevel();
    const lowBattery = battery !== null && battery < 0.2;

    const all = await listQueue();
    let succeeded = 0;
    let failed = 0;

    for (const op of all) {
      if (lowBattery && op.priority !== 'critical') continue;
      if (!isReady(op)) continue;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-idempotency-key': op.idempotencyKey,
          },
          body: JSON.stringify(op),
        });
        if (res.ok) {
          await ack(op.id);
          succeeded += 1;
          lastResults.push({ id: op.id, resource: op.resource, ok: true });
        } else {
          const errMsg = `http ${res.status}`;
          await bumpAttempt(op.id, errMsg);
          failed += 1;
          lastResults.push({ id: op.id, resource: op.resource, ok: false, error: errMsg });
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await bumpAttempt(op.id, errMsg);
        failed += 1;
        lastResults.push({ id: op.id, resource: op.resource, ok: false, error: errMsg });
      }
    }

    if (!lowBattery) {
      const photos = await listPhotos();
      for (const p of photos) {
        if (!isReady(p)) continue;
        const r = await uploadPhoto(p);
        if (r.ok) {
          await ackPhoto(p.id);
          succeeded += 1;
          lastResults.push({ id: p.id, resource: `photo:${p.targetResource}`, ok: true });
        } else {
          await bumpPhoto(p.id, r.error);
          failed += 1;
          lastResults.push({ id: p.id, resource: `photo:${p.targetResource}`, ok: false, error: r.error });
        }
      }
    }

    const remaining = (await listQueue()).length + (await listPhotos()).length;
    lastDrainedAt = new Date().toISOString();
    lastError = failed > 0 ? `${failed} op(s) failed` : null;
    return { succeeded, failed, pending: remaining, lastResults };
  } finally {
    processingCount = Math.max(0, processingCount - 1);
    void emit();
  }
}

export { uuid as makeIdempotencyKey, MAX_ATTEMPTS };
