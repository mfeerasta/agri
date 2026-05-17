import * as React from 'react';
import { cn } from '../lib/cn.js';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[14px] bg-[var(--surface)] border border-[var(--border)] shadow-soft transition-colors hover:border-[var(--border-strong)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 border-b border-[var(--border)]', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[1rem] font-medium text-[var(--fg)] tracking-tight m-0', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)]/40 rounded-b-[14px]', className)} {...props} />;
}
