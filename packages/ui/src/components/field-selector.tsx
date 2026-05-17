'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface FieldOption {
  id: string;
  code: string;
  name?: string | null;
  nameUr?: string | null;
  acres: number;
  currentCropLabel?: string | null;
}

export interface FieldSelectorProps {
  options: FieldOption[];
  value?: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function FieldSelector({ options, value, onChange, placeholder = 'Pick a field', className }: FieldSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const filtered = options.filter((o) => {
    const q = query.toLowerCase();
    return !q || o.code.toLowerCase().includes(q) || (o.name ?? '').toLowerCase().includes(q);
  });
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b border-[var(--rule)] bg-transparent py-2 text-left font-mono text-[0.95rem]"
      >
        {selected ? (
          <span className="flex items-baseline gap-2">
            <span className="smallcaps text-[0.7rem] text-[var(--ochre)]">{selected.code}</span>
            <span>{selected.name ?? selected.nameUr ?? '—'}</span>
            <span className="text-[var(--ink)]/50 text-xs">· {selected.acres.toFixed(2)} acre</span>
          </span>
        ) : (
          <span className="text-[var(--ink)]/40">{placeholder}</span>
        )}
        <span aria-hidden className="font-mono text-xs">▾</span>
      </button>
      {open ? (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 border border-[var(--rule)] bg-[var(--paper)] shadow-ink">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search code or name"
            className="w-full border-b border-[var(--rule)] bg-transparent px-3 py-2 text-sm focus-visible:outline-none"
          />
          <ul className="max-h-72 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--ink)]/50">No fields</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--paper-2)]',
                      o.id === value && 'bg-[var(--paper-2)]',
                    )}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="smallcaps text-[0.7rem] text-[var(--ochre)]">{o.code}</span>
                      <span className="font-body">{o.name ?? o.nameUr ?? '—'}</span>
                    </span>
                    <span className="tabular text-xs text-[var(--ink)]/60">
                      {o.acres.toFixed(2)} ac · {o.currentCropLabel ?? '—'}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
