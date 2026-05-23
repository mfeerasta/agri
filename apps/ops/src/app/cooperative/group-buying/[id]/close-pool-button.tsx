'use client';
import { useState, useTransition } from 'react';
import { closePoolAndRequestRfq } from '../../actions';

export function ClosePoolButton({ poolId }: { poolId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className="smallcaps rounded-sm bg-[var(--paper-2)] px-3 py-2 text-xs"
        onClick={() =>
          start(async () => {
            const res = await closePoolAndRequestRfq(poolId);
            setMsg(res.ok ? 'Pool closed, RFQ aggregated' : res.error);
          })
        }
      >
        {pending ? 'Closing' : 'Close pool and request RFQ'}
      </button>
      {msg && <span className="text-xs text-[var(--zameen-700)]">{msg}</span>}
    </div>
  );
}
