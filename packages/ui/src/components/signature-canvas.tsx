'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface SignatureCanvasHandle {
  clear: () => void;
  toDataURL: () => string;
  isEmpty: () => boolean;
}

export const SignatureCanvas = React.forwardRef<SignatureCanvasHandle, { className?: string; height?: number }>(
  function SignatureCanvas({ className, height = 160 }, ref) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const drawing = React.useRef(false);
    const dirty = React.useRef(false);

    React.useImperativeHandle(
      ref,
      () => ({
        clear() {
          const c = canvasRef.current;
          if (!c) return;
          const ctx = c.getContext('2d');
          ctx?.clearRect(0, 0, c.width, c.height);
          dirty.current = false;
        },
        toDataURL() {
          return canvasRef.current?.toDataURL('image/png') ?? '';
        },
        isEmpty() {
          return !dirty.current;
        },
      }),
      [],
    );

    function point(e: React.PointerEvent<HTMLCanvasElement>) {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function start(e: React.PointerEvent<HTMLCanvasElement>) {
      const c = canvasRef.current;
      if (!c) return;
      c.setPointerCapture(e.pointerId);
      drawing.current = true;
      const ctx = c.getContext('2d')!;
      ctx.strokeStyle = '#0F1A12';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const p = point(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
    function move(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = canvasRef.current!.getContext('2d')!;
      const p = point(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      dirty.current = true;
    }
    function end() {
      drawing.current = false;
    }

    return (
      <canvas
        ref={canvasRef}
        width={600}
        height={height}
        className={cn('w-full touch-none border border-[var(--rule)] bg-[var(--paper)]', className)}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
    );
  },
);
