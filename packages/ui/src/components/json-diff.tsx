import * as React from 'react';
import { cn } from '../lib/cn.js';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface JsonDiffProps {
  before: JsonValue | null | undefined;
  after: JsonValue | null | undefined;
  className?: string;
}

interface DiffNode {
  path: string;
  kind: 'added' | 'removed' | 'changed' | 'same';
  before?: JsonValue;
  after?: JsonValue;
}

function isPlainObject(v: JsonValue | null | undefined): v is { [k: string]: JsonValue } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function diff(before: JsonValue | null | undefined, after: JsonValue | null | undefined, path = ''): DiffNode[] {
  if (before === undefined && after === undefined) return [];
  if (before === undefined) return [{ path, kind: 'added', after: after ?? null }];
  if (after === undefined) return [{ path, kind: 'removed', before: before ?? null }];
  if (JSON.stringify(before) === JSON.stringify(after)) return [{ path, kind: 'same', before, after }];

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const out: DiffNode[] = [];
    for (const k of keys) {
      const childPath = path ? `${path}.${k}` : k;
      out.push(...diff(before[k], after[k], childPath));
    }
    return out;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    const out: DiffNode[] = [];
    for (let i = 0; i < max; i += 1) {
      out.push(...diff(before[i], after[i], `${path}[${i}]`));
    }
    return out;
  }

  return [{ path, kind: 'changed', before: before ?? null, after: after ?? null }];
}

function renderValue(v: JsonValue | null | undefined): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

const ROW_BASE = 'flex items-start gap-2 font-mono text-[11px] leading-relaxed py-0.5 px-2 rounded';

export function JsonDiff({ before, after, className }: JsonDiffProps) {
  const nodes = diff(before, after);
  if (nodes.length === 0) {
    return <div className={cn('text-xs italic text-[var(--fg-muted)]', className)}>(no data)</div>;
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {nodes.map((n, i) => {
        if (n.kind === 'same') {
          return (
            <div key={i} className={cn(ROW_BASE, 'text-[var(--fg-muted)]/60')}>
              <span className="w-3 text-center"> </span>
              <span className="opacity-60">{n.path || '(root)'}</span>
              <span className="text-[var(--fg-muted)]/50">= {renderValue(n.before)}</span>
            </div>
          );
        }
        if (n.kind === 'added') {
          return (
            <div
              key={i}
              className={cn(ROW_BASE, 'bg-[var(--success)]/10 text-[var(--success)]')}
            >
              <span className="w-3 text-center">+</span>
              <span className="font-medium">{n.path || '(root)'}</span>
              <span>= {renderValue(n.after)}</span>
            </div>
          );
        }
        if (n.kind === 'removed') {
          return (
            <div
              key={i}
              className={cn(ROW_BASE, 'bg-[var(--danger)]/10 text-[var(--danger)]')}
            >
              <span className="w-3 text-center">-</span>
              <span className="font-medium">{n.path || '(root)'}</span>
              <span>= {renderValue(n.before)}</span>
            </div>
          );
        }
        return (
          <div key={i} className="space-y-0.5">
            <div className={cn(ROW_BASE, 'bg-[var(--danger)]/10 text-[var(--danger)]')}>
              <span className="w-3 text-center">-</span>
              <span className="font-medium">{n.path || '(root)'}</span>
              <span>= {renderValue(n.before)}</span>
            </div>
            <div className={cn(ROW_BASE, 'bg-[var(--success)]/10 text-[var(--success)]')}>
              <span className="w-3 text-center">+</span>
              <span className="font-medium">{n.path || '(root)'}</span>
              <span>= {renderValue(n.after)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
