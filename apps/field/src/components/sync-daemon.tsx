'use client';
import * as React from 'react';
import { drain, listQueue, listPhotos } from '../lib/offline-queue.js';
import { useSyncStore } from '../lib/sync-store.js';

const TICK_MS = 60_000;

export function SyncDaemon() {
  const setPending = useSyncStore((s) => s.setPending);
  const setState = useSyncStore((s) => s.setState);
  const markDrain = useSyncStore((s) => s.markDrain);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let lastSucceededWithZero = false;

    async function recountPending() {
      const [q, p] = await Promise.all([listQueue(), listPhotos()]);
      setPending(q.length + p.length);
    }

    async function tick() {
      if (cancelled) return;
      if (!navigator.onLine) {
        setState('pending');
        return;
      }
      if (lastSucceededWithZero) {
        await recountPending();
        return;
      }
      try {
        const result = await drain();
        markDrain();
        setPending(result.pending);
        lastSucceededWithZero = result.pending === 0 && result.failed === 0;
        setState(result.failed > 0 ? 'error' : result.pending > 0 ? 'pending' : 'synced');
      } catch {
        setState('error');
      }
    }

    function onOnline() {
      lastSucceededWithZero = false;
      void tick();
    }
    function onOffline() {
      setState('pending');
    }

    void recountPending();
    void tick();
    const id = window.setInterval(tick, TICK_MS);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setPending, setState, markDrain]);

  return null;
}
