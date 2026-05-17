import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface StatusLabelProps {
  status: string;
  colorMap?: Record<string, string>;
  className?: string;
  onClick?: () => void;
}

const DEFAULT_COLORS: Record<string, string> = {
  open: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  todo: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  draft: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  reported: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  planned: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  in_progress: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  in_review: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  submitted: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  quotes_pending: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  done: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  executed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  harvested: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  blocked: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  sent_back: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  on_hold: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  emergency_executed: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export function statusColor(status: string, colorMap?: Record<string, string>): string {
  return (colorMap?.[status] ?? DEFAULT_COLORS[status] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/30');
}

export function StatusLabel({ status, colorMap, className, onClick }: StatusLabelProps) {
  const klass = statusColor(status, colorMap);
  const Tag: keyof JSX.IntrinsicElements = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium tracking-tight whitespace-nowrap',
        klass,
        onClick ? 'cursor-pointer hover:opacity-90' : '',
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </Tag>
  );
}
