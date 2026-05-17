'use client';
import * as React from 'react';
import { SyncStatus, type SyncStatusOp, type SyncStatusTone } from '@zameen/ui';
import {
  listQueue,
  listPhotos,
  subscribeToQueue,
  retryNow,
  dismissOp,
  drainNow,
  MAX_ATTEMPTS,
} from '../lib/offline-queue.js';

interface SnapState {
  ops: SyncStatusOp[];
  pendingCount: number;
  failedCount: number;
}

export function SyncStatusHost() {
  const [online, setOnline] = React.useState(true);
  const [snap, setSnap] = React.useState<SnapState>({ ops: [], pendingCount: 0, failedCount: 0 });

  const refresh = React.useCallback(async () => {
    const [qs, ps] = await Promise.all([listQueue(), listPhotos()]);
    const ops: SyncStatusOp[] = [];
    let pendingCount = 0;
    let failedCount = 0;
    for (const q of qs) {
      const failed = q.attempts >= MAX_ATTEMPTS;
      if (failed) failedCount += 1;
      else pendingCount += 1;
      ops.push({
        id: q.id,
        resource: `${q.resource}/${q.operation}`,
        clientCreatedAt: q.clientCreatedAt,
        attempts: q.attempts,
        lastError: q.lastError,
        failed,
      });
    }
    for (const p of ps) {
      const failed = p.attempts >= MAX_ATTEMPTS;
      if (failed) failedCount += 1;
      else pendingCount += 1;
      ops.push({
        id: p.id,
        resource: `photo:${p.targetResource}`,
        clientCreatedAt: p.clientCreatedAt,
        attempts: p.attempts,
        lastError: p.lastError,
        failed,
      });
    }
    setSnap({ ops, pendingCount, failedCount });
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const unsub = subscribeToQueue(() => {
      void refresh();
    });
    void refresh();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      unsub();
    };
  }, [refresh]);

  const tone: SyncStatusTone = !online || snap.failedCount > 0
    ? 'red'
    : snap.pendingCount > 0
      ? 'amber'
      : 'green';

  return (
    <SyncStatus
      tone={tone}
      online={online}
      pendingCount={snap.pendingCount}
      failedCount={snap.failedCount}
      ops={snap.ops}
      onRetry={async (id) => {
        await retryNow(id);
        await refresh();
      }}
      onDismiss={async (id) => {
        await dismissOp(id);
        await refresh();
      }}
      onDrainAll={async () => {
        await drainNow();
        await refresh();
      }}
      onRefresh={refresh}
    />
  );
}
