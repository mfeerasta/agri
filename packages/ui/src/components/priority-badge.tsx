import * as React from 'react';
import { cn } from '../lib/cn.js';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityBadgeProps {
  priority: Priority | string | null | undefined;
  className?: string;
}

const STYLE: Record<Priority, string> = {
  low: 'bg-slate-500/15 text-slate-300',
  medium: 'bg-sky-500/15 text-sky-300',
  high: 'bg-amber-500/15 text-amber-300',
  urgent: 'bg-rose-500/15 text-rose-300',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const p = (priority ?? 'medium') as Priority;
  const klass = STYLE[p] ?? STYLE.medium;
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider', klass, className)}>
      {p}
    </span>
  );
}
