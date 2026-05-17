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

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle>Zameen Approver · Sign in</CardTitle></CardHeader>
      <CardContent className="space-y-4">
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
