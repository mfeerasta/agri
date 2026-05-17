/**
 * Offline-op enqueue. Native uses `@capacitor/preferences` (durable across
 * app kill on iOS + Android). Web falls back to `localStorage`. The web
 * PWA's existing IndexedDB queue still owns the replay loop; this storage
 * is a belt-and-braces persistence layer so a force-quit doesn't lose ops
 * that haven't yet been picked up by the replayer.
 */

import { Preferences } from '@capacitor/preferences';
import { isNative } from './index';

const KEY = 'zameen.ops.offline-ops';

export interface OfflineOp {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: number;
}

export async function enqueueOp(op: OfflineOp): Promise<void> {
  const current = await readAll();
  current.push(op);
  await writeAll(current);
}

export async function readAll(): Promise<OfflineOp[]> {
  if (isNative()) {
    const { value } = await Preferences.get({ key: KEY });
    return parse(value);
  }
  if (typeof window === 'undefined') return [];
  return parse(window.localStorage.getItem(KEY));
}

export async function clear(): Promise<void> {
  if (isNative()) {
    await Preferences.remove({ key: KEY });
    return;
  }
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
}

async function writeAll(ops: OfflineOp[]): Promise<void> {
  const value = JSON.stringify(ops);
  if (isNative()) {
    await Preferences.set({ key: KEY, value });
    return;
  }
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, value);
}

function parse(value: string | null | undefined): OfflineOp[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as OfflineOp[];
    return [];
  } catch {
    return [];
  }
}
