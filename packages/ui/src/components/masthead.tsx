import * as React from 'react';

export interface MastheadProps {
  section: string;
  entity?: string;
  farm?: string;
  date?: Date;
}

function toHijri(d: Date): string {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}

function toGregorian(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function Masthead({ section, entity = 'Rupafab Agri', farm = 'Raiwind Farm', date }: MastheadProps) {
  const now = date ?? new Date();
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-4 pb-6 mb-6 border-b border-[var(--border)]">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-3xl font-semibold tracking-tight text-[var(--fg)]">{section}</span>
        <span className="hidden md:inline text-[var(--fg-subtle)]">·</span>
        <span className="hidden md:inline text-sm text-[var(--fg-muted)]">{entity}</span>
        <span className="hidden md:inline text-[var(--fg-subtle)]">·</span>
        <span className="hidden md:inline text-sm text-[var(--fg-muted)]">{farm}</span>
      </div>
      <div className="tabular text-xs text-[var(--fg-subtle)] flex items-center gap-2">
        <span>{toHijri(now)}</span>
        <span>·</span>
        <span>{toGregorian(now)}</span>
      </div>
    </header>
  );
}
