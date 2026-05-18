import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users } from '@zameen/db';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import {
  NotificationsPrefsClient,
  type NotificationPrefsShape,
  type Channel,
  EVENT_KEYS,
} from './notifications-client';

export const dynamic = 'force-dynamic';

const ALL_PUSH: Channel[] = ['in_app', 'whatsapp', 'push'];
const ALL_FOUR: Channel[] = ['in_app', 'whatsapp', 'email', 'push'];
const IN_APP_PUSH: Channel[] = ['in_app', 'push'];

const DEFAULT_PREFS: NotificationPrefsShape = {
  approvalSubmitted: ALL_PUSH,
  approvalDecided: ALL_PUSH,
  escalationReminder: ALL_FOUR,
  mention: IN_APP_PUSH,
  taskAssigned: IN_APP_PUSH,
  taskDueSoon: IN_APP_PUSH,
  taskOverdue: ALL_PUSH,
  anomalyDiesel: IN_APP_PUSH,
  anomalyWeather: IN_APP_PUSH,
  diagnosticFlagged: IN_APP_PUSH,
  digestDaily: ['email'],
  digestWeekly: ['email'],
  quietHours: { enabled: false, startHhmm: '22:00', endHhmm: '06:00' },
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
  const prefs: NotificationPrefsShape = { ...DEFAULT_PREFS };
  for (const key of EVENT_KEYS) {
    const incoming = raw[key];
    if (Array.isArray(incoming)) {
      prefs[key] = incoming.filter((c): c is Channel =>
        c === 'in_app' || c === 'whatsapp' || c === 'email' || c === 'push',
      );
    }
  }
  if (raw.quietHours && typeof raw.quietHours === 'object') {
    const q = raw.quietHours;
    prefs.quietHours = {
      enabled: Boolean(q.enabled),
      startHhmm: typeof q.startHhmm === 'string' && /^\d{2}:\d{2}$/.test(q.startHhmm) ? q.startHhmm : '22:00',
      endHhmm: typeof q.endHhmm === 'string' && /^\d{2}:\d{2}$/.test(q.endHhmm) ? q.endHhmm : '06:00',
    };
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Notification preferences</h1>
      <p className="text-sm text-[var(--ink-muted)]">
        Choose which channels deliver each event. In-app rows are always written; turning a channel off
        only suppresses the outbound ping. Use the Quiet Hours panel below to silence push, WhatsApp,
        and email during a daily window.
      </p>
      <NotificationsPrefsClient initial={prefs} />
    </main>
  );
}
