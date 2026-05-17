'use client';

import { useTrainingMode } from '../lib/training-store';

export function TrainingBanner() {
  const { on } = useTrainingMode();
  if (!on) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full bg-yellow-400 text-black border-b border-yellow-600 px-3 py-2 text-center text-sm font-medium"
    >
      <span className="mr-2" aria-hidden>🟡</span>
      <span className="urdu">آپ تربیتی موڈ میں ہیں</span>
      <span className="mx-2">·</span>
      <span>Training mode (data will be deleted)</span>
    </div>
  );
}
