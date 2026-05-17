import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-[10px] font-medium transition-all disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)]',
        accent:
          'bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-strong)]',
        secondary:
          'bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--border-strong)]',
        outline:
          'bg-transparent text-[var(--fg)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
        danger:
          'bg-[var(--danger)] text-[var(--bg)] hover:opacity-90',
        ghost:
          'bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]',
      },
      size: {
        sm: 'h-8 px-3 text-xs min-h-[40px] md:min-h-[32px]',
        md: 'h-10 px-4 text-sm min-h-[44px] md:min-h-[40px]',
        lg: 'h-12 px-6 text-[0.95rem] min-h-[48px] md:min-h-[48px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
