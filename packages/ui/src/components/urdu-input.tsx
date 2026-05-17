'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';
import { Input } from './input.js';

export const UrduInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function UrduInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        lang="ur"
        dir="rtl"
        className={cn('urdu text-right', className)}
        {...props}
      />
    );
  },
);
