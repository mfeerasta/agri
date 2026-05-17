import * as React from 'react';
import { cn } from '../lib/cn.js';

export type SyncState = 'synced' | 'pending' | 'error';

const COLOR: Record<SyncState, string> = {
  synced: 'bg-[var(--zameen-500)]',
  pending: 'bg-[var(--clay)]',
  error: 'bg-[var(--rust)]',
};

const LABEL: Record<SyncState, string> = {
  synced: 'Synced',
  pending: 'Pending',
  error: 'Sync error',
};

export function PendingSync({ state, className }: { state: SyncState; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 smallcaps text-[0.65rem] text-[var(--ink)]/80',
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', COLOR[state], state === 'pending' && 'animate-pulse')} />
      {LABEL[state]}
    </span>
  );
}
