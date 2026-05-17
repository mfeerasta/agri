import { redirect } from 'next/navigation';
import { EnablePush } from '@zameen/ui';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { listUserCredentials } from '../../lib/webauthn';
import { PasskeysManager } from './passkeys-manager';

export const dynamic = 'force-dynamic';

export default async function PasskeysPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const credentials = await listUserCredentials(data.user.id);
  const view = credentials.map((c) => ({
    id: c.id,
    deviceLabel: c.device_label,
    lastUsedAt: c.last_used_at,
    createdAt: c.created_at,
  }));

  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Passkeys</h1>
      <p className="text-sm text-[var(--ink-muted)]">
        Register Face ID / Touch ID on this device for instant sign-in.
      </p>
      <PasskeysManager credentials={view} />

      <section className="space-y-2 border-t border-[var(--rule)] pt-4">
        <h2 className="text-base font-semibold">Push notifications</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Get approval pings on this device's home screen. Add to Home Screen first on iPhone.
        </p>
        <EnablePush
          vapidPublicKey={process.env.NEXT_PUBLIC_ZAMEEN_VAPID_PUBLIC_KEY ?? ''}
          deviceLabel="Approver"
        />
      </section>
    </main>
  );
}
