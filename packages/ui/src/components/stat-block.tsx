import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface StatBlockProps {
  label: string;
  value: React.ReactNode;
  caption?: string;
  delta?: { value: number; label?: string } | React.ReactNode;
  className?: string;
}

function isDeltaShape(d: unknown): d is { value: number; label?: string } {
  return typeof d === 'object' && d !== null && 'value' in d && typeof (d as { value: unknown }).value === 'number';
}

export function StatBlock({ label, value, caption, delta, className }: StatBlockProps) {
  const shaped = isDeltaShape(delta) ? delta : null;
  const positive = shaped ? shaped.value >= 0 : false;
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[14px] bg-[var(--surface)] border border-[var(--border)] p-5 shadow-soft hover:border-[var(--border-strong)] transition-colors',
        className,
      )}
    >
      <div className="smallcaps">{label}</div>
      <div className="font-display text-4xl font-semibold tracking-tight text-[var(--fg)] tabular-nums">{value}</div>
      <div className="flex items-baseline gap-2 text-[0.78rem]">
        {shaped ? (
          <span
            className={cn(
              'tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              positive ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--danger)]/15 text-[var(--danger)]',
            )}
          >
            {positive ? '↑' : '↓'} {Math.abs(shaped.value)}{shaped.label ? ` ${shaped.label}` : '%'}
          </span>
        ) : delta ? (
          delta
        ) : null}
        {caption ? <span className="text-[var(--fg-muted)]">{caption}</span> : null}
      </div>
    </div>
  );
}
