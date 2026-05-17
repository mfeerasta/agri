import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface SectionDividerProps {
  label?: string;
  className?: string;
}

export function SectionDivider({ label, className }: SectionDividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3 my-8', className)}>
        <span className="smallcaps">{label}</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
    );
  }
  return <div className={cn('h-px bg-[var(--border)] my-8', className)} />;
}
