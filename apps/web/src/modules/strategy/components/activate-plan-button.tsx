'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { activatePlan } from '../actions';

export function ActivatePlanButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await activatePlan(planId);
          if (res.ok) router.refresh();
        })
      }
      className="rounded border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
    >
      {pending ? 'Activating...' : 'Mark active'}
    </button>
  );
}
