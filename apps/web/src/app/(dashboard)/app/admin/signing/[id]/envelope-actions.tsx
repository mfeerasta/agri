'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { sendEnvelope, sendReminder, voidEnvelope } from '@/modules/signing/actions';

export function EnvelopeActions({ envelopeId, status }: { envelopeId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function doSend() {
    setBusy(true);
    setMsg(null);
    const r = await sendEnvelope(envelopeId);
    setBusy(false);
    setMsg(r.ok ? 'Sent to signers.' : r.error);
    router.refresh();
  }

  async function doRemind() {
    setBusy(true);
    setMsg(null);
    const r = await sendReminder({ envelopeId });
    setBusy(false);
    setMsg(r.ok ? 'Reminders dispatched.' : r.error);
  }

  async function doVoid() {
    const reason = window.prompt('Reason for voiding this envelope?');
    if (!reason || reason.length < 5) return;
    setBusy(true);
    setMsg(null);
    const r = await voidEnvelope({ envelopeId, reason });
    setBusy(false);
    setMsg(r.ok ? 'Envelope voided.' : r.error);
    router.refresh();
  }

  const canSend = status === 'draft';
  const canRemind = status === 'sent' || status === 'partially_signed';
  const canVoid = status !== 'completed' && status !== 'voided' && status !== 'expired';

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {canSend ? (
        <button onClick={doSend} disabled={busy} className="smallcaps text-[0.7rem] px-3 py-2 bg-[var(--ink)] text-[var(--paper)] disabled:opacity-50">
          Send to signers
        </button>
      ) : null}
      {canRemind ? (
        <button onClick={doRemind} disabled={busy} className="smallcaps text-[0.7rem] px-3 py-2 border border-[var(--rule)] disabled:opacity-50">
          Send reminders
        </button>
      ) : null}
      {canVoid ? (
        <button onClick={doVoid} disabled={busy} className="smallcaps text-[0.7rem] px-3 py-2 border border-[var(--rule)] text-red-700 disabled:opacity-50">
          Void
        </button>
      ) : null}
      {msg ? <div className="text-xs text-[var(--ink)]/70 self-center">{msg}</div> : null}
    </div>
  );
}
