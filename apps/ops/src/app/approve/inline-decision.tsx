'use client';
import * as React from 'react';
import { Button, Textarea } from '@zameen/ui';
import { decideAction } from './actions';

export function InlineDecision({ approvalRequestId }: { approvalRequestId: string }) {
  const [comment, setComment] = React.useState('');
  const [busy, setBusy] = React.useState<'approve' | 'reject' | 'send_back' | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function act(action: 'approve' | 'reject' | 'send_back') {
    setBusy(action);
    setErr(null);
    const r = await decideAction({ approvalRequestId, action, comment: comment || undefined });
    setBusy(null);
    if (!r.ok) setErr(r.error);
    else window.location.reload();
  }

  return (
    <div className="space-y-2">
      <Textarea placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <Button variant="primary" onClick={() => act('approve')} disabled={busy !== null}>Approve</Button>
        <Button variant="danger" onClick={() => act('reject')} disabled={busy !== null}>Reject</Button>
        <Button variant="outline" onClick={() => act('send_back')} disabled={busy !== null}>Send back</Button>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
