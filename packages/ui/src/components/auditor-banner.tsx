import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface AuditorBannerProps {
  role: 'auditor' | 'external_accountant' | 'accountant';
  entityName?: string;
  className?: string;
}

const COPY: Record<AuditorBannerProps['role'], { title: string; tagline: string }> = {
  auditor: {
    title: 'Read-only auditor mode',
    tagline: 'All views are logged. No edits, no exports outside packs.',
  },
  external_accountant: {
    title: 'Read-only external accountant mode',
    tagline: 'All views are logged. No edits, no exports outside packs.',
  },
  accountant: {
    title: 'Accountant mode',
    tagline: 'Financial views are logged for the audit trail.',
  },
};

export function AuditorBanner({ role, entityName, className }: AuditorBannerProps) {
  const copy = COPY[role];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-between gap-4 border-b border-[var(--rule)] px-4 py-2 text-sm',
        className,
      )}
      style={{ background: 'rgba(245,180,84,0.08)', color: 'var(--warning)' }}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="font-mono">●</span>
        <span className="smallcaps text-[0.7rem] tracking-wider">{copy.title}</span>
        {entityName ? (
          <span className="text-[var(--fg)]/80 text-[0.78rem]">· {entityName}</span>
        ) : null}
      </span>
      <span className="text-[0.72rem] opacity-80">{copy.tagline}</span>
    </div>
  );
}
