import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface ConfidenceBadgeProps {
  confidence: number;
  label?: string;
  className?: string;
}

/**
 * Tiny percentage chip in red (<0.5), amber (<0.8), green (>=0.8) used for
 * OCR extraction confidence so reviewers know how much to trust auto-fill.
 */
export function ConfidenceBadge({ confidence, label, className }: ConfidenceBadgeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const tone =
    confidence >= 0.8
      ? 'bg-green-100 text-green-800 border-green-300'
      : confidence >= 0.5
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-red-100 text-red-800 border-red-300';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
    >
      {label ?? 'confidence'}: {pct}%
    </span>
  );
}
