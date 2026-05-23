'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { releaseQuarantine } from '../../gate/actions';

export function ReleaseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [show, setShow] = useState(false);
  const [notes, setNotes] = useState('');

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="rounded border px-2 py-1 text-xs">
        Release
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <input
        className="rounded border p-1 text-xs"
        placeholder="Release notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        onClick={() =>
          start(async () => {
            await releaseQuarantine(id, notes || undefined);
            setShow(false);
            router.refresh();
          })
        }
        disabled={pending}
        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
      >
        {pending ? '...' : 'Confirm'}
      </button>
    </div>
  );
}
