'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendInvitations } from '@/modules/procurement/rfq-actions';

export function RfqSendInvitationsButton({ rfqId }: { rfqId: string }): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await sendInvitations({ rfqId });
          router.refresh();
        })
      }
      className="border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem] hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-40"
    >
      {pending ? 'Sending...' : 'Send invitations'}
    </button>
  );
}
