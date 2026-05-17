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
}

const Q_PREFIX = 'queue:';
const P_PREFIX = 'photo:';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
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
}

export async function bumpAttempt(id: string): Promise<void> {
  const r = (await get(Q_PREFIX + id)) as QueuedOp | undefined;
  if (r) await set(Q_PREFIX + id, { ...r, attempts: r.attempts + 1 });
}

export async function enqueuePhoto(p: Omit<PendingPhoto, 'id' | 'attempts' | 'clientCreatedAt' | 'idempotencyKey'> & { idempotencyKey?: string }): Promise<string> {
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
}

export async function bumpPhoto(id: string): Promise<void> {
  const r = (await get(P_PREFIX + id)) as PendingPhoto | undefined;
  if (r) await set(P_PREFIX + id, { ...r, attempts: r.attempts + 1 });
}

interface BatteryManager {
  level: number;
  charging: boolean;
}
async function getBatteryLevel(): Promise<number | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  if (typeof nav.getBattery !== 'function') return null;
  try {
    const b: BatteryManager = await nav.getBattery();
    return b.charging ? 1 : b.level;
  } catch {
    return null;
  }
}

async function uploadPhoto(p: PendingPhoto): Promise<boolean> {
  try {
    const presignRes = await fetch('/api/uploads/r2-presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contentType: p.contentType, prefix: p.targetResource }),
    });
    if (!presignRes.ok) return false;
    const { uploadUrl, publicUrl } = (await presignRes.json()) as {
      uploadUrl: string;
      publicUrl: string;
    };
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': p.contentType },
      body: p.blob,
    });
    if (!putRes.ok) return false;
    // Attach URL to target record via sync endpoint
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
    return attachRes.ok;
  } catch {
    return false;
  }
}

export async function drain(endpoint = '/api/sync'): Promise<{ succeeded: number; failed: number; pending: number }> {
  const battery = await getBatteryLevel();
  const lowBattery = battery !== null && battery < 0.2;

  const all = await listQueue();
  let succeeded = 0;
  let failed = 0;

  for (const op of all) {
    if (lowBattery && op.priority !== 'critical') continue;
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
      } else {
        await bumpAttempt(op.id);
        failed += 1;
      }
    } catch {
      await bumpAttempt(op.id);
      failed += 1;
    }
  }

  if (!lowBattery) {
    const photos = await listPhotos();
    for (const p of photos) {
      const ok = await uploadPhoto(p);
      if (ok) {
        await ackPhoto(p.id);
        succeeded += 1;
      } else {
        await bumpPhoto(p.id);
        failed += 1;
      }
    }
  }

  const remaining = (await listQueue()).length + (await listPhotos()).length;
  return { succeeded, failed, pending: remaining };
}

export { uuid as makeIdempotencyKey };
