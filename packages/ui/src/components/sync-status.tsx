'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export type SyncStatusTone = 'green' | 'amber' | 'red';

export interface SyncStatusOp {
  id: string;
  resource: string;
  clientCreatedAt: string;
  attempts: number;
  lastError?: string;
  failed: boolean;
}

export interface SyncStatusProps {
  tone: SyncStatusTone;
  pendingCount: number;
  failedCount: number;
  ops: SyncStatusOp[];
  onRetry: (id: string) => void | Promise<void>;
  onDismiss: (id: string) => void | Promise<void>;
  onDrainAll?: () => void | Promise<void>;
  online: boolean;
  pollIntervalMsWhenOpen?: number;
  pollIntervalMsWhenClosed?: number;
  onRefresh?: () => void | Promise<void>;
}

const TONE_DOT: Record<SyncStatusTone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
};

const TONE_RING: Record<SyncStatusTone, string> = {
  green: 'ring-emerald-200',
  amber: 'ring-amber-200',
  red: 'ring-rose-200',
};

export function SyncStatus({
  tone,
  pendingCount,
  failedCount,
  ops,
  onRetry,
  onDismiss,
  onDrainAll,
  online,
  pollIntervalMsWhenOpen = 2_000,
  pollIntervalMsWhenClosed = 30_000,
  onRefresh,
}: SyncStatusProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!onRefresh) return;
    const ms = open ? pollIntervalMsWhenOpen : pollIntervalMsWhenClosed;
    const id = window.setInterval(() => {
      void onRefresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [open, onRefresh, pollIntervalMsWhenOpen, pollIntervalMsWhenClosed]);

  const label = !online
    ? 'Offline'
    : failedCount > 0
      ? `${failedCount} failed`
      : pendingCount > 0
        ? `${pendingCount} pending`
        : 'Synced';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Sync status: ${label}`}
        className={cn(
          'inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs ring-1 min-h-[36px]',
          TONE_RING[tone],
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', TONE_DOT[tone], tone !== 'green' && 'animate-pulse')} />
        <span className="tabular text-[var(--ink)]">{label}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Sync queue drawer"
          className="absolute end-0 top-full z-40 mt-2 w-[min(92vw,360px)] rounded-xl border border-[var(--ink)]/10 bg-white p-3 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-sm text-[var(--zameen-700)]">Sync queue</h3>
            {onDrainAll ? (
              <button
                type="button"
                onClick={() => void onDrainAll()}
                className="text-xs underline underline-offset-2 text-[var(--zameen-700)]"
              >
                Drain now
              </button>
            ) : null}
          </div>
          {ops.length === 0 ? (
            <p className="text-xs text-[var(--ink)]/60">Nothing queued.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--ink)]/5">
              {ops.map((op) => (
                <li key={op.id} className="py-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{op.resource}</p>
                    <p className="tabular text-[10px] text-[var(--ink)]/60">
                      {new Date(op.clientCreatedAt).toLocaleString()}
                      {op.attempts > 0 ? ` · attempts ${op.attempts}` : null}
                    </p>
                    {op.lastError ? (
                      <p className="text-[10px] text-rose-600 truncate">{op.lastError}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void onRetry(op.id)}
                      className="rounded-md bg-[var(--zameen-700)] px-2 py-1 text-[10px] text-white"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDismiss(op.id)}
                      className="rounded-md bg-[var(--ink)]/10 px-2 py-1 text-[10px]"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
