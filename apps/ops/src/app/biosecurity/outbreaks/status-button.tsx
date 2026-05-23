'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOutbreakStatus } from '../../gate/actions';

export function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await setOutbreakStatus(id, status);
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded border px-2 py-1 text-xs"
    >
      {label}
    </button>
  );
}
