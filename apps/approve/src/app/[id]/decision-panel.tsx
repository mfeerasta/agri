'use client';
import * as React from 'react';
import { BigButton, Textarea } from '@zameen/ui';
import { decideAction } from './actions';

export function DecisionPanel({ approvalRequestId }: { approvalRequestId: string }) {
  const [comment, setComment] = React.useState('');
  const [busy, setBusy] = React.useState<'approve' | 'reject' | 'send_back' | 'escalate' | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function act(action: 'approve' | 'reject' | 'send_back' | 'escalate') {
    setBusy(action); setErr(null);
    const gps: GeolocationPosition | null = await new Promise((res) => {
      if (!('geolocation' in navigator)) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res(p), () => res(null), { timeout: 4000 });
    });
    const r = await decideAction({
      approvalRequestId,
      action,
      comment: comment || undefined,
      gpsLocation: gps ? { lat: gps.coords.latitude, lng: gps.coords.longitude, accuracyM: gps.coords.accuracy } : undefined,
    });
    setBusy(null);
    if (!r.ok) setErr(r.error);
    else window.location.reload();
  }

  return (
    <div className="space-y-3">
      <Textarea placeholder="Comment (optional, supports Urdu)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <BigButton tone="success" label="Approve" onClick={() => act('approve')} disabled={busy !== null} />
        <BigButton tone="danger" label="Reject" onClick={() => act('reject')} disabled={busy !== null} />
        <BigButton tone="warning" label="Send back" onClick={() => act('send_back')} disabled={busy !== null} />
        <BigButton tone="neutral" label="Escalate" onClick={() => act('escalate')} disabled={busy !== null} />
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
