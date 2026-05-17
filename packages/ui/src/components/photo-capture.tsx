'use client';
import * as React from 'react';
import { Camera, X } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface PhotoCaptureProps {
  value: string[];
  onChange: (urls: string[]) => void;
  uploadFn: (file: File) => Promise<string>;
  max?: number;
  required?: boolean;
  label?: string;
  preserveExif?: boolean;
  className?: string;
}

async function compress(file: File, preserveExif = true): Promise<File> {
  if (preserveExif && file.size <= 200 * 1024) return file;
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const longEdge = 1600;
  const scale = Math.min(1, longEdge / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.82)!);
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export function PhotoCapture({
  value,
  onChange,
  uploadFn,
  max = 5,
  required,
  label,
  preserveExif = true,
  className,
}: PhotoCaptureProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...value];
      for (const file of Array.from(files)) {
        if (next.length >= max) break;
        const out = await compress(file, preserveExif);
        const url = await uploadFn(out);
        next.push(url);
      }
      onChange(next);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={cn(className)}>
      {label ? (
        <div className="smallcaps text-[0.72rem] text-[var(--ink)]/80 mb-2">
          {label}
          {required ? <span className="text-[var(--rust)]"> *</span> : null}
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, idx) => (
          <div
            key={url}
            className="relative aspect-square border border-[var(--rule)] bg-[var(--paper-2)]"
          >
            <img
              src={url}
              alt={`photo ${idx + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute right-1 top-1 bg-[var(--ink)] p-1 text-[var(--paper)]"
              aria-label="Remove photo"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
      {value.length < max ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 border border-[var(--ink)] bg-[var(--paper)] px-5 py-3 transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
          >
            <Camera size={18} strokeWidth={1.5} />
            <span className="smallcaps">{busy ? 'Uploading' : 'Take photo'}</span>
            <span className="tabular text-[0.7rem] opacity-60">{value.length}/{max}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.currentTarget.files)}
          />
        </div>
      ) : null}
    </div>
  );
}
