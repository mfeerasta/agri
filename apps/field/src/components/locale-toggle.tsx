'use client';
import * as React from 'react';
import { useLocaleStore } from '../lib/locale-store.js';
import type { Locale } from '@zameen/locale';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'ur', label: 'اردو' },
  { value: 'roman_ur', label: 'Roman' },
  { value: 'pa', label: 'پنجابی' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'en', label: 'EN' },
];

export function LocaleToggle() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <div role="tablist" className="inline-flex flex-wrap border border-[var(--rule)]">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={locale === opt.value}
          onClick={() => setLocale(opt.value)}
          className={
            'smallcaps px-2 py-1 text-[0.7rem] min-h-[44px] min-w-[44px] ' +
            (locale === opt.value
              ? 'bg-[var(--ink)] text-[var(--paper)]'
              : 'bg-transparent text-[var(--ink)]')
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
