'use client';
import * as React from 'react';
import { PendingSync } from '@zameen/ui';
import { useSyncStore } from '../lib/sync-store.js';

export function SyncBadge() {
  const state = useSyncStore((s) => s.state);
  const pending = useSyncStore((s) => s.pending);
  return (
    <span className="inline-flex items-center gap-2">
      <PendingSync state={state} />
      {pending > 0 ? (
        <span className="tabular text-[0.7rem] text-[var(--ink)]/70">{pending}</span>
      ) : null}
    </span>
  );
}
