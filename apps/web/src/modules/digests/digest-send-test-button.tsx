'use client';

import { useTransition, useState } from 'react';
import { sendTestDigest } from './actions';

export function DigestSendTestButton({ subscriptionId }: { subscriptionId: string }) {
  const [isPending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() =>
          start(async () => {
            const res = await sendTestDigest(subscriptionId);
            setResult(res.ok ? 'Sent' : `Failed: ${res.error}`);
          })
        }
        disabled={isPending}
        className="text-[0.75rem] underline disabled:opacity-50"
      >
        {isPending ? 'Sending…' : 'Send test now'}
      </button>
      {result && <span className="text-[0.7rem] text-[var(--ink)]/60">{result}</span>}
    </div>
  );
}
