'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BigButton, Input } from '@zameen/ui';
import { t } from '@zameen/locale';
import { useLocaleStore } from '../../lib/locale-store';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

function normalizePkPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  if (digits.startsWith('3')) return `+92${digits}`;
  return raw.startsWith('+') ? raw : `+${digits}`;
}

export function LoginForm() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [step, setStep] = React.useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const normalized = normalizePkPhone(phone);
      const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (err) throw err;
      setPhone(normalized);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (err) throw err;
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendOtp} className="space-y-3">
        <label className="block">
          <span className="smallcaps text-[0.72rem] text-[var(--ink)]/80 block mb-2">
            {t('auth.phone', locale)}
          </span>
          <Input
            type="tel"
            inputMode="numeric"
            dir="ltr"
            placeholder="+92 3xx xxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.currentTarget.value)}
            required
            className="min-h-[64px] text-lg"
          />
        </label>
        {error ? <p className="text-sm text-[var(--rust)]">{error}</p> : null}
        <BigButton type="submit" label={busy ? '...' : t('auth.send_otp', locale)} disabled={busy} tone="primary" />
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-3">
      <p className="text-sm">
        {t('auth.welcome', locale)} {phone}
      </p>
      <label className="block">
        <span className="smallcaps text-[0.72rem] text-[var(--ink)]/80 block mb-2">
          {t('auth.otp', locale)}
        </span>
        <Input
          type="text"
          inputMode="numeric"
          dir="ltr"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.currentTarget.value.replace(/\D/g, ''))}
          required
          className="min-h-[64px] text-2xl tracking-widest text-center"
        />
      </label>
      {error ? <p className="text-sm text-[var(--rust)]">{error}</p> : null}
      <BigButton type="submit" label={busy ? '...' : t('auth.verify', locale)} disabled={busy || otp.length < 6} tone="success" />
      <button
        type="button"
        onClick={() => setStep('phone')}
        className="block w-full text-center text-sm text-[var(--ink)]/60 min-h-[44px]"
      >
        ← {t('action.cancel', locale)}
      </button>
    </form>
  );
}
