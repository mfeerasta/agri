import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface ApprovalBannerProps {
  state:
    | 'submitted'
    | 'in_review'
    | 'approved'
    | 'rejected'
    | 'sent_back'
    | 'executed'
    | 'emergency_executed'
    | 'draft'
    | 'closed';
  amountPkr?: string;
  approverName?: string;
}

interface Spec {
  glyph: string;
  bg: string;
  fg: string;
}

const SPEC: Record<ApprovalBannerProps['state'], Spec> = {
  draft: { glyph: '○', bg: 'rgba(255,255,255,0.04)', fg: 'var(--fg-muted)' },
  submitted: { glyph: '●', bg: 'rgba(91,227,255,0.12)', fg: 'var(--accent)' },
  in_review: { glyph: '●', bg: 'rgba(245,180,84,0.12)', fg: 'var(--warning)' },
  approved: { glyph: '✓', bg: 'rgba(52,211,153,0.12)', fg: 'var(--success)' },
  executed: { glyph: '✓', bg: 'rgba(52,211,153,0.16)', fg: 'var(--success)' },
  rejected: { glyph: '✕', bg: 'rgba(248,113,113,0.14)', fg: 'var(--danger)' },
  sent_back: { glyph: '↺', bg: 'rgba(245,180,84,0.12)', fg: 'var(--warning)' },
  emergency_executed: { glyph: '!', bg: 'rgba(248,113,113,0.16)', fg: 'var(--danger)' },
  closed: { glyph: '◦', bg: 'rgba(255,255,255,0.04)', fg: 'var(--fg-subtle)' },
};

export function ApprovalBanner({ state, amountPkr, approverName }: ApprovalBannerProps) {
  const spec = SPEC[state];
  return (
    <div
      className={cn('flex items-center justify-between gap-4 rounded-[10px] px-3 py-2 text-sm')}
      style={{ background: spec.bg, color: spec.fg }}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="font-mono text-sm">{spec.glyph}</span>
        <span className="smallcaps" style={{ color: 'inherit' }}>{state.replace(/_/g, ' ')}</span>
      </span>
      <span className="flex items-center gap-3 tabular text-[0.85rem] text-[var(--fg)]/90">
        {amountPkr ? <span>Rs. {amountPkr}</span> : null}
        {approverName ? <span className="opacity-70">→ {approverName}</span> : null}
      </span>
    </div>
  );
}
