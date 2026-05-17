import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface EmptyStateProps {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/40 px-6 py-16 text-center',
        className,
      )}
    >
      <div className="font-display text-lg text-[var(--fg)]">{title}</div>
      {body ? <p className="max-w-md text-sm text-[var(--fg-muted)]">{body}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
