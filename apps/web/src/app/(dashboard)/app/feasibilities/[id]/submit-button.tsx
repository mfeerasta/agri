'use client';

import { useTransition } from 'react';
import { submitFeasibilityForApproval } from '@/modules/feasibilities/actions';

export function SubmitForApprovalButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await submitFeasibilityForApproval(id);
        })
      }
      disabled={pending}
      className="mt-2 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
    >
      {pending ? 'Submitting...' : 'Submit for Director approval'}
    </button>
  );
}
