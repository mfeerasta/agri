import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users } from '@zameen/db';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { NotificationsPrefsClient, type NotificationPrefsShape } from './notifications-client';

export const dynamic = 'force-dynamic';

const DEFAULT_PREFS: NotificationPrefsShape = {
  approvalSubmitted: ['in_app', 'whatsapp', 'push'],
  approvalDecided: ['in_app', 'whatsapp', 'push'],
  mention: ['in_app', 'push'],
  anomalyDetected: ['in_app', 'push'],
  escalationReminder: ['in_app', 'whatsapp', 'push', 'email'],
};

export default async function NotificationsPrefsPage(): Promise<React.ReactElement> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const [row] = await db
    .select({ prefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, data.user.id))
    .limit(1);

  const raw = (row?.prefs as Partial<NotificationPrefsShape> | undefined) ?? {};
  const prefs: NotificationPrefsShape = {
    approvalSubmitted: raw.approvalSubmitted ?? DEFAULT_PREFS.approvalSubmitted,
    approvalDecided: raw.approvalDecided ?? DEFAULT_PREFS.approvalDecided,
    mention: raw.mention ?? DEFAULT_PREFS.mention,
    anomalyDetected: raw.anomalyDetected ?? DEFAULT_PREFS.anomalyDetected,
    escalationReminder: raw.escalationReminder ?? DEFAULT_PREFS.escalationReminder,
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Notification preferences</h1>
      <p className="text-sm text-[var(--ink-muted)]">
        Choose which channels deliver each event. In-app rows are always written; turning a channel off
        only suppresses the outbound ping.
      </p>
      <NotificationsPrefsClient initial={prefs} />
    </main>
  );
}
