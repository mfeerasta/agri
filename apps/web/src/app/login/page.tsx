'use client';
import * as React from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [phone, setPhone] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [stage, setStage] = React.useState<'phone' | 'otp'>('phone');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) setError(error.message);
    else setStage('otp');
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    setBusy(false);
    if (error) setError(error.message);
    else window.location.href = '/app';
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Zameen — Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stage === 'phone' ? (
            <>
              <Label htmlFor="phone">Phone (Pakistan)</Label>
              <Input id="phone" placeholder="+923xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button className="w-full" disabled={busy || !phone} onClick={sendOtp}>
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <Label htmlFor="otp">Enter OTP</Label>
              <Input id="otp" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} />
              <Button className="w-full" disabled={busy || !otp} onClick={verifyOtp}>
                Verify
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStage('phone')}>
                Change number
              </Button>
            </>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
