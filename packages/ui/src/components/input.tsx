import * as React from 'react';
import { cn } from '../lib/cn.js';

const baseInput = cn(
  'h-10 w-full rounded-[10px] bg-[var(--surface-2)] px-3.5 py-2',
  'border border-[var(--border)]',
  'font-body text-[0.95rem] text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
  'focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)]',
  'transition-colors disabled:opacity-50',
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(baseInput, className)} {...props} />;
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-[0.78rem] font-medium text-[var(--fg-muted)]', className)}
      {...props}
    />
  );
}

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[88px] w-full rounded-[10px] bg-[var(--surface-2)] px-3.5 py-2.5 border border-[var(--border)]',
        'font-body text-[0.95rem] text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
        'focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)]',
        className,
      )}
      {...props}
    />
  );
});
