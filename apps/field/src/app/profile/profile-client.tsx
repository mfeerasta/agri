'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BigButton, EnablePush } from '@zameen/ui';
import { t } from '@zameen/locale';
import { LocaleToggle } from '../../components/locale-toggle';
import { SyncBadge } from '../../components/sync-badge';
import Link from 'next/link';
import { useLocaleStore } from '../../lib/locale-store';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { useTrainingMode } from '../../lib/training-store';

const APP_VERSION = '0.1.0';

export function ProfileClient() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const [busy, setBusy] = React.useState(false);
  const { on: trainingOn, toggle: toggleTraining, steps: trainingSteps } = useTrainingMode();

  async function signOut() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="smallcaps text-[0.72rem] text-[var(--ink)]/70">{t('language.toggle', locale)}</h2>
        <LocaleToggle />
      </section>

      <section className="flex items-center justify-between border-t border-[var(--rule)] pt-3">
        <span className="smallcaps text-[0.72rem] text-[var(--ink)]/70">Sync</span>
        <SyncBadge />
      </section>

      <section className="space-y-2 border-t border-[var(--rule)] pt-3">
        <span className="smallcaps text-[0.72rem] text-[var(--ink)]/70">Push notifications</span>
        <EnablePush
          vapidPublicKey={process.env.NEXT_PUBLIC_ZAMEEN_VAPID_PUBLIC_KEY ?? ''}
          deviceLabel="Field device"
        />
      </section>

      <section className="flex items-center justify-between border-t border-[var(--rule)] pt-3">
        <span className="smallcaps text-[0.72rem] text-[var(--ink)]/70">{t('app.version', locale)}</span>
        <span className="tabular text-xs">{APP_VERSION}</span>
      </section>

      <section className="space-y-2 border-t border-[var(--rule)] pt-3">
        <div className="flex items-center justify-between">
          <span className="smallcaps text-[0.72rem] text-[var(--ink)]/70">Training mode · تربیتی موڈ</span>
          <button
            type="button"
            onClick={() => toggleTraining(!trainingOn)}
            aria-pressed={trainingOn}
            className={`min-h-[36px] px-3 py-1.5 rounded text-xs font-medium ${
              trainingOn ? 'bg-yellow-400 text-black' : 'bg-[var(--paper-2)] text-[var(--ink)]'
            }`}
          >
            {trainingOn ? 'ON · آن' : 'OFF · آف'}
          </button>
        </div>
        {trainingOn && (
          <>
            <p className="text-xs text-[var(--ink)]/70 urdu">
              تربیتی موڈ میں آپ کا کوئی بھی ڈیٹا اصل ریکارڈ میں شامل نہیں ہوگا۔
            </p>
            <p className="text-xs text-[var(--ink)]/70">
              Steps completed: {trainingSteps.length}/8
            </p>
            <Link
              href="/training"
              className="inline-flex items-center min-h-[36px] text-xs underline text-[var(--ink)]/80"
            >
              Open training walkthrough
            </Link>
          </>
        )}
      </section>

      <BigButton onClick={signOut} label={busy ? '...' : t('app.sign_out', locale)} tone="danger" disabled={busy} />
    </div>
  );
}
