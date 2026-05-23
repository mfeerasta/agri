import { redirect } from 'next/navigation';
import { getSessionContext } from '../../../../../lib/session';
import { getNotificationPreferences } from '../../../../../modules/settings/notification-actions';
import { NotificationSettingsClient } from './notifications-client';

export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage(): Promise<React.ReactElement> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const prefs = await getNotificationPreferences();
  if (!prefs) redirect('/login');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Notification preferences</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Choose which channels stay on, mute specific event kinds, set a quiet-hours window, and
          pick how often non-urgent alerts get batched into a digest.
        </p>
      </header>
      <NotificationSettingsClient initial={prefs} />
    </main>
  );
}
