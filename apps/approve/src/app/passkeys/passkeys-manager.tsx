'use client';
import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@zameen/ui';

interface CredentialView {
  id: string;
  deviceLabel: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export function PasskeysManager({ credentials }: { credentials: CredentialView[] }) {
  const [deviceLabel, setDeviceLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function register() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optsRes = await fetch('/api/webauthn/register/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error('Could not fetch registration options');
      const opts = await optsRes.json();
      const attestation = await startRegistration({ optionsJSON: opts });
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: attestation, deviceLabel: deviceLabel || undefined }),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok || !result.ok) throw new Error(result.error ?? 'Registration failed');
      setMsg('Passkey registered. Reload to see it in the list.');
      setDeviceLabel('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Register this device</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="device-label">Device label (optional)</Label>
          <Input
            id="device-label"
            placeholder="e.g. MF iPhone 16"
            value={deviceLabel}
            onChange={(e) => setDeviceLabel(e.currentTarget.value)}
          />
          <Button className="w-full" disabled={busy} onClick={register}>
            Register passkey
          </Button>
          {msg ? <p className="text-sm text-[var(--moss)]">{msg}</p> : null}
          {err ? <p className="text-sm text-[var(--rust)]">{err}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registered passkeys</CardTitle></CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No passkeys yet.</p>
          ) : (
            <ul className="space-y-2">
              {credentials.map((c) => (
                <li key={c.id} className="flex justify-between text-sm border-b pb-2">
                  <span>{c.deviceLabel ?? 'Unlabeled device'}</span>
                  <span className="text-[var(--ink-muted)]">
                    {c.lastUsedAt ? `Last used ${new Date(c.lastUsedAt).toLocaleDateString()}` : 'Never used'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
