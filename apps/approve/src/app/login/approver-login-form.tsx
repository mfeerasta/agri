'use client';
import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@zameen/ui';
import { createBrowserClient } from '@supabase/ssr';

export function ApproverLoginForm() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const [stage, setStage] = React.useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [passkeySupported, setPasskeySupported] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined') {
      setPasskeySupported(true);
    }
  }, []);

  async function send() {
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) setErr(error.message); else setStage('otp');
  }
  async function verify() {
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    setBusy(false);
    if (error) setErr(error.message); else window.location.href = '/';
  }

  async function passkeySignIn() {
    setBusy(true); setErr(null);
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optsRes = await fetch('/api/webauthn/auth/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error('Could not fetch passkey options');
      const opts = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: opts });
      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok || !result.ok) throw new Error(result.error ?? 'Passkey sign-in failed');
      window.location.href = result.redirectTo as string;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Passkey sign-in failed');
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle>Zameen Approver · Sign in</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {passkeySupported ? (
          <>
            <Button className="w-full" disabled={busy} onClick={passkeySignIn}>
              Sign in with passkey
            </Button>
            <div className="text-center text-xs text-[var(--ink-muted)]">or use phone OTP</div>
          </>
        ) : null}
        {stage === 'phone' ? (
          <>
            <Label htmlFor="phone">Phone (Pakistan)</Label>
            <Input id="phone" placeholder="+923xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            <Button className="w-full" disabled={busy || !phone} onClick={send}>Send OTP</Button>
          </>
        ) : (
          <>
            <Label htmlFor="otp">Enter OTP</Label>
            <Input id="otp" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.currentTarget.value)} />
            <Button className="w-full" disabled={busy || !otp} onClick={verify}>Verify</Button>
            <Button variant="ghost" className="w-full" onClick={() => setStage('phone')}>Change number</Button>
          </>
        )}
        {err ? <p className="text-sm text-[var(--rust)]">{err}</p> : null}
      </CardContent>
    </Card>
  );
}
