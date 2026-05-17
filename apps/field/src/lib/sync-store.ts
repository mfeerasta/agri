'use client';
import { create } from 'zustand';
import type { SyncState } from '@zameen/ui';

interface SyncStore {
  state: SyncState;
  pending: number;
  lastDrainAt: string | null;
  setState: (s: SyncState) => void;
  setPending: (n: number) => void;
  markDrain: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  state: 'synced',
  pending: 0,
  lastDrainAt: null,
  setState: (s) => set({ state: s }),
  setPending: (n) => set({ pending: n, state: n === 0 ? 'synced' : 'pending' }),
  markDrain: () => set({ lastDrainAt: new Date().toISOString() }),
}));
