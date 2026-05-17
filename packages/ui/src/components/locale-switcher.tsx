'use client';

import * as React from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../lib/cn.js';

export type SwitcherLocale = 'ur' | 'roman_ur' | 'pa' | 'hi' | 'en';

export interface LocaleSwitcherProps {
  current: SwitcherLocale;
  onChange: (locale: SwitcherLocale) => void | Promise<void>;
  className?: string;
}

const LABELS: Record<SwitcherLocale, string> = {
  ur: 'اردو',
  roman_ur: 'Roman',
  pa: 'پنجابی',
  hi: 'हिन्दी',
  en: 'English',
};

const GROUPS: { header: string; locales: SwitcherLocale[] }[] = [
  { header: 'Pakistan', locales: ['ur', 'roman_ur', 'pa'] },
  { header: 'India', locales: ['hi'] },
  { header: 'Global', locales: ['en'] },
];

export function LocaleSwitcher({ current, onChange, className }: LocaleSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--surface-2)] min-h-[44px] md:min-h-[40px]"
      >
        <Globe size={16} strokeWidth={1.8} />
        <span>{LABELS[current]}</span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-soft"
        >
          {GROUPS.map((group) => (
            <li key={group.header} className="border-b border-[var(--border)] last:border-b-0">
              <div className="px-3 pt-2 pb-1 text-[0.65rem] uppercase tracking-wide text-[var(--fg)]/50">
                {group.header}
              </div>
              {group.locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  role="option"
                  aria-selected={loc === current}
                  onClick={async () => {
                    setOpen(false);
                    await onChange(loc);
                  }}
                  className={cn(
                    'block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]',
                    loc === current ? 'text-[var(--accent)]' : 'text-[var(--fg)]',
                  )}
                >
                  {LABELS[loc]}
                </button>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
