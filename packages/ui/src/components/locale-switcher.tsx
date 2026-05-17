'use client';

import * as React from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../lib/cn.js';

export type SwitcherLocale = 'ur' | 'roman_ur' | 'en';

export interface LocaleSwitcherProps {
  current: SwitcherLocale;
  onChange: (locale: SwitcherLocale) => void | Promise<void>;
  className?: string;
}

const LABELS: Record<SwitcherLocale, string> = {
  ur: 'اردو',
  roman_ur: 'Roman',
  en: 'English',
};

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
          className="absolute right-0 z-50 mt-1 min-w-[140px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-soft"
        >
          {(Object.keys(LABELS) as SwitcherLocale[]).map((loc) => (
            <li key={loc}>
              <button
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
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
