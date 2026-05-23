'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleProtocol } from '../../gate/actions';

export function ToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await toggleProtocol(id, !isActive);
          router.refresh();
        })
      }
      disabled={pending}
      className={`rounded px-2 py-1 text-xs ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
    >
      {isActive ? 'active' : 'inactive'}
    </button>
  );
}
