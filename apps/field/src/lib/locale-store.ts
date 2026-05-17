'use client';
import { create } from 'zustand';
import type { Locale } from '@zameen/locale';

interface LocaleStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const STORAGE_KEY = 'zameen.field.locale';

function loadInitial(): Locale {
  if (typeof window === 'undefined') return 'ur';
  const v = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  return v ?? 'ur';
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: loadInitial(),
  setLocale: (l) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, l);
    set({ locale: l });
  },
}));
