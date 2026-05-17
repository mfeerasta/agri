'use client';
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn.js';

export type FilterType = 'enum' | 'date' | 'person' | 'text';

export interface FilterDef {
  key: string;
  label: string;
  type: FilterType;
  options?: Array<{ value: string; label: string }>;
}

export interface FilterBarProps {
  filters: FilterDef[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  groupBy?: string | null;
  onGroupByChange?: (key: string | null) => void;
  groupableKeys?: Array<{ key: string; label: string }>;
  className?: string;
}

export function FilterBar({
  filters,
  value,
  onChange,
  groupBy,
  onGroupByChange,
  groupableKeys,
  className,
}: FilterBarProps) {
  function setFilter(key: string, val: unknown) {
    const next = { ...value };
    if (val === '' || val === null || val === undefined) delete next[key];
    else next[key] = val;
    onChange(next);
  }

  function clear(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  const activeKeys = Object.keys(value).filter((k) => value[k] !== undefined && value[k] !== '');

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {filters.map((f) => {
        const raw = value[f.key];
        if (f.type === 'enum' && f.options) {
          return (
            <select
              key={f.key}
              value={typeof raw === 'string' ? raw : ''}
              onChange={(e) => setFilter(f.key, e.target.value)}
              className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)]"
            >
              <option value="">{f.label}: any</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        }
        if (f.type === 'date') {
          return (
            <input
              key={f.key}
              type="date"
              value={typeof raw === 'string' ? raw : ''}
              onChange={(e) => setFilter(f.key, e.target.value)}
              placeholder={f.label}
              className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)]"
            />
          );
        }
        return (
          <input
            key={f.key}
            type="text"
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => setFilter(f.key, e.target.value)}
            placeholder={f.label}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)]"
          />
        );
      })}

      {groupableKeys && onGroupByChange ? (
        <select
          value={groupBy ?? ''}
          onChange={(e) => onGroupByChange(e.target.value || null)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)]"
        >
          <option value="">Group by: none</option>
          {groupableKeys.map((g) => (
            <option key={g.key} value={g.key}>
              Group by: {g.label}
            </option>
          ))}
        </select>
      ) : null}

      {activeKeys.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {activeKeys.map((k) => {
            const def = filters.find((f) => f.key === k);
            if (!def) return null;
            const v = value[k];
            const label =
              def.type === 'enum' && def.options
                ? (def.options.find((o) => o.value === v)?.label ?? String(v))
                : String(v);
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.7rem]"
              >
                <span className="text-[var(--fg-muted)]">{def.label}:</span> {label}
                <button type="button" onClick={() => clear(k)} aria-label={`Clear ${def.label}`} className="text-[var(--fg-subtle)] hover:text-[var(--danger)]">
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
