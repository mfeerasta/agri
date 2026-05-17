import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EnablePush } from '@zameen/ui';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminProfilePage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const fullName =
    (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email ?? data.user.id;

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm text-[var(--ink-muted)]">{fullName}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Push notifications</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Approval pings to this browser. Each device subscribes independently.
        </p>
        <EnablePush
          vapidPublicKey={process.env.NEXT_PUBLIC_ZAMEEN_VAPID_PUBLIC_KEY ?? ''}
          deviceLabel="Web dashboard"
        />
      </section>

      <section className="space-y-2 border-t border-[var(--rule)] pt-4">
        <h2 className="text-base font-semibold">Channels per event</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Choose how Zameen pings you for each event type.
        </p>
        <Link
          href="/admin/profile/notifications"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--rule)] px-4 py-2 text-sm font-medium hover:bg-[var(--paper-2)]"
        >
          Edit notification preferences
        </Link>
      </section>
    </main>
  );
}
