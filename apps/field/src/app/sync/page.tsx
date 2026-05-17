'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@zameen/ui';
import {
  listQueue,
  listPhotos,
  retryNow,
  dismissOp,
  retryFailed,
  clearFailed,
  drainNow,
  exportQueueJson,
  subscribeToQueue,
  MAX_ATTEMPTS,
  type QueuedOp,
  type PendingPhoto,
  type DrainResult,
} from '../../lib/offline-queue.js';

interface DisplayOp {
  id: string;
  resource: string;
  operation: string;
  clientCreatedAt: string;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  failed: boolean;
  kind: 'op' | 'photo';
}

function toDisplay(q: QueuedOp[], p: PendingPhoto[]): DisplayOp[] {
  const ops: DisplayOp[] = q.map((r) => ({
    id: r.id,
    resource: r.resource,
    operation: r.operation,
    clientCreatedAt: r.clientCreatedAt,
    attempts: r.attempts,
    lastError: r.lastError,
    nextRetryAt: r.nextRetryAt,
    failed: r.attempts >= MAX_ATTEMPTS,
    kind: 'op',
  }));
  const photos: DisplayOp[] = p.map((r) => ({
    id: r.id,
    resource: r.targetResource,
    operation: 'photo',
    clientCreatedAt: r.clientCreatedAt,
    attempts: r.attempts,
    lastError: r.lastError,
    nextRetryAt: r.nextRetryAt,
    failed: r.attempts >= MAX_ATTEMPTS,
    kind: 'photo',
  }));
  return [...ops, ...photos].sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
}

export default function SyncPage() {
  const [items, setItems] = React.useState<DisplayOp[]>([]);
  const [lastResult, setLastResult] = React.useState<DrainResult | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const [q, p] = await Promise.all([listQueue(), listPhotos()]);
    setItems(toDisplay(q, p));
  }, []);

  React.useEffect(() => {
    const unsub = subscribeToQueue(() => {
      void refresh();
    });
    void refresh();
    return unsub;
  }, [refresh]);

  const handleDrain = async () => {
    setBusy(true);
    try {
      const r = await drainNow();
      setLastResult(r);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const handleRetryAll = async () => {
    setBusy(true);
    try {
      await retryFailed();
      const r = await drainNow();
      setLastResult(r);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const handleClearFailed = async () => {
    await clearFailed();
    await refresh();
  };

  const handleExport = async () => {
    const json = await exportQueueJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zameen-queue-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const failedCount = items.filter((i) => i.failed).length;
  const pendingCount = items.length - failedCount;

  const explanation = lastResult
    ? `Drained ${lastResult.succeeded} successfully, ${lastResult.failed} failed. ${
        lastResult.pending
      } operations remain in the queue. Failed items will retry on the exponential backoff schedule (5s, 30s, 5min, 30min, 4h).`
    : null;

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-[var(--zameen-700)]">قطار اور بحالی</h1>
        <Link href="/" className="text-xs underline">گھر</Link>
      </div>

      <Card>
        <CardContent>
          <p className="urdu text-sm">{pendingCount} زیرِ التواء · {failedCount} ناکام</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleDrain}
          className="rounded-lg bg-[var(--zameen-700)] px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          ابھی بھیجیں
        </button>
        <button
          type="button"
          disabled={busy || failedCount === 0}
          onClick={handleRetryAll}
          className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          ناکام دوبارہ
        </button>
        <button
          type="button"
          disabled={failedCount === 0}
          onClick={handleClearFailed}
          className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          ناکام صاف
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg bg-[var(--ink)]/10 px-3 py-2 text-sm"
        >
          JSON برآمد
        </button>
      </div>

      {lastResult ? (
        <Card>
          <CardContent>
            <p className="text-xs text-[var(--ink)]/70">{explanation}</p>
          </CardContent>
        </Card>
      ) : null}

      <ul className="space-y-2">
        {items.map((op) => (
          <li
            key={op.id}
            className="rounded-lg border border-[var(--ink)]/10 bg-white p-3 flex items-start justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {op.resource} <span className="text-[var(--ink)]/50">/{op.operation}</span>
              </p>
              <p className="tabular text-[10px] text-[var(--ink)]/60">
                {new Date(op.clientCreatedAt).toLocaleString()} · attempts {op.attempts}
              </p>
              {op.lastError ? <p className="text-[10px] text-rose-600">{op.lastError}</p> : null}
              {op.nextRetryAt && !op.failed ? (
                <p className="text-[10px] text-amber-700">next try {new Date(op.nextRetryAt).toLocaleTimeString()}</p>
              ) : null}
              {op.failed ? <p className="text-[10px] text-rose-700">gave up after {MAX_ATTEMPTS} attempts</p> : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => retryNow(op.id).then(refresh)}
                className="rounded-md bg-[var(--zameen-700)] px-2 py-1 text-[10px] text-white"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => dismissOp(op.id).then(refresh)}
                className="rounded-md bg-[var(--ink)]/10 px-2 py-1 text-[10px]"
              >
                Drop
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
