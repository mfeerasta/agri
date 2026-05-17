'use client';
import * as React from 'react';

export interface ExportButtonsProps {
  endpoint: string;
  query?: Record<string, string | undefined>;
  formats?: Array<'pdf' | 'xlsx'>;
  label?: string;
}

export function ExportButtons({ endpoint, query, formats = ['pdf', 'xlsx'], label = 'Download' }: ExportButtonsProps) {
  function build(format: 'pdf' | 'xlsx'): string {
    const params = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v) params.set(k, v);
      }
    }
    params.set('format', format);
    return `${endpoint}?${params.toString()}`;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">{label}</span>
      {formats.map((f) => (
        <a
          key={f}
          href={build(f)}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs uppercase tracking-wider text-[var(--fg)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]"
          download
        >
          {f}
        </a>
      ))}
    </div>
  );
}
