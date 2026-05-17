import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface PkrProps {
  value: number | string | bigint;
  mode?: 'plain' | 'lac_crore';
  locale?: 'en' | 'ur';
  className?: string;
  bare?: boolean;
}

function toNumber(v: number | string | bigint): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v) / 100;
  return Number(v);
}

export function Pkr({ value, mode = 'plain', locale = 'en', className, bare }: PkrProps) {
  const num = toNumber(value);
  if (Number.isNaN(num)) return <span className={cn('tabular text-[var(--fg-subtle)]', className)}>—</span>;
  const abs = Math.abs(num);
  let body: string;
  if (mode === 'lac_crore' && abs >= 100_000) {
    body = abs >= 10_000_000 ? `${(num / 10_000_000).toFixed(2)} crore` : `${(num / 100_000).toFixed(2)} lac`;
  } else {
    body = new Intl.NumberFormat(locale === 'ur' ? 'ur-PK' : 'en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 text-[var(--fg)]', className)}>
      {bare ? null : <span className="text-[var(--fg-subtle)] text-[0.72em] font-medium">Rs.</span>}
      <span className="tabular">{body}</span>
    </span>
  );
}
