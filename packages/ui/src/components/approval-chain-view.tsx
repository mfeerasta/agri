import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface ApprovalChainStep {
  role: string;
  userName: string;
  state: 'pending' | 'approved' | 'rejected' | 'skipped';
  occurredAt?: string;
  avatarUrl?: string;
}

const MARK: Record<ApprovalChainStep['state'], string> = {
  pending: '●',
  approved: '✓',
  rejected: '✕',
  skipped: '·',
};

const MARK_COLOR: Record<ApprovalChainStep['state'], string> = {
  pending: 'text-[var(--clay)] animate-pulse',
  approved: 'text-[var(--zameen-500)]',
  rejected: 'text-[var(--rust)]',
  skipped: 'text-[var(--ink)]/40',
};

export function ApprovalChainView({ steps, className }: { steps: ApprovalChainStep[]; className?: string }) {
  return (
    <ol className={cn('flex w-full items-center justify-between gap-2', className)}>
      {steps.map((s, i) => (
        <React.Fragment key={`${s.role}-${i}`}>
          <li className="flex flex-col items-center gap-1 text-center">
            <span className={cn('font-mono text-lg leading-none', MARK_COLOR[s.state])}>{MARK[s.state]}</span>
            <span className="smallcaps text-[0.65rem] text-[var(--ink)]/80">{s.role.replace(/_/g, ' ')}</span>
            <span className="font-body text-[0.78rem] text-[var(--ink)]">{s.userName}</span>
            {s.occurredAt ? (
              <span className="tabular text-[0.65rem] text-[var(--ink)]/50">
                {new Date(s.occurredAt).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : null}
          </li>
          {i < steps.length - 1 ? <li aria-hidden className="flex-1 h-px bg-[var(--rule)]" /> : null}
        </React.Fragment>
      ))}
    </ol>
  );
}
