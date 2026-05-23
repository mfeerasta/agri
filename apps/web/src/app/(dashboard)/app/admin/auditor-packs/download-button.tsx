'use client';

import * as React from 'react';
import { resignPackUrl } from './actions';

export function DownloadButton({ packId }: { packId: string }) {
  const [pending, startTransition] = React.useTransition();
  function onClick() {
    startTransition(async () => {
      try {
        const { url } = await resignPackUrl(packId);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Failed');
      }
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-[6px] border border-[var(--rule)] px-3 py-1 text-xs smallcaps disabled:opacity-50"
    >
      {pending ? '…' : 'Download'}
    </button>
  );
}
