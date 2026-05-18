'use client';
import * as React from 'react';
import Image from 'next/image';
import { Camera, X } from 'lucide-react';
import { BigButton } from './big-button.js';
import { cn } from '../lib/cn.js';

export interface PhotoUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  uploadFn: (file: File) => Promise<string>;
  max?: number;
  required?: boolean;
  label?: string;
}

/**
 * Camera-first uploader. Uses `capture="environment"` so phones jump
 * straight to the rear camera. Compresses images client-side before
 * upload to keep prepaid-data bills sane.
 */
export function PhotoUploader({ value, onChange, uploadFn, max = 5, required, label }: PhotoUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function compress(file: File): Promise<File> {
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
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.8)!);
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...value];
      for (const file of Array.from(files)) {
        if (next.length >= max) break;
        const compressed = await compress(file);
        const url = await uploadFn(compressed);
        next.push(url);
      }
      onChange(next);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      {label ? <div className="mb-2 text-sm font-medium">{label}{required ? <span className="text-red-600"> *</span> : null}</div> : null}
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, idx) => (
          <div key={url} className="relative aspect-square">
            <Image
              src={url}
              alt={`photo ${idx + 1}`}
              fill
              sizes="(max-width: 640px) 33vw, 200px"
              className="rounded-md object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow"
              aria-label="Remove photo"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {value.length < max ? (
        <div className="mt-3">
          <BigButton
            type="button"
            icon={<Camera />}
            label={busy ? '…' : 'Take photo'}
            sublabel={`${value.length}/${max}`}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            tone="neutral"
            className={cn(busy && 'opacity-60')}
          />
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
