import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface BigButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
}

const TONES: Record<NonNullable<BigButtonProps['tone']>, string> = {
  primary: 'bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--accent)]',
  accent: 'bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-strong)]',
  success: 'bg-[var(--success)] text-[var(--bg)] hover:opacity-90',
  warning: 'bg-[var(--warning)] text-[var(--bg)] hover:opacity-90',
  danger: 'bg-[var(--danger)] text-[var(--bg)] hover:opacity-90',
  neutral: 'bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--border-strong)]',
};

export const BigButton = React.forwardRef<HTMLButtonElement, BigButtonProps>(function BigButton(
  { icon, label, sublabel, tone = 'primary', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'group flex w-full min-h-[64px] items-center gap-4 rounded-[14px] px-5 py-4 text-start font-medium transition-all active:scale-[0.99]',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 [&>svg]:h-6 [&>svg]:w-6 [&>svg]:stroke-[1.8]">{icon}</span> : null}
      <span className="flex flex-col leading-tight">
        <span className="text-[1.05rem] font-medium tracking-tight">{label}</span>
        {sublabel ? <span className="text-[0.78rem] opacity-70 mt-0.5">{sublabel}</span> : null}
      </span>
    </button>
  );
});
