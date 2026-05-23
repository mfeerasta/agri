'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, notificationPreferences, type ChannelsEnabled, type DigestMode } from '@zameen/db';
import { getSessionContext } from '../../lib/session';

const VALID_CHANNELS = ['in_app', 'whatsapp', 'email', 'push'] as const;
type Channel = (typeof VALID_CHANNELS)[number];

const VALID_DIGEST_MODES: ReadonlySet<DigestMode> = new Set([
  'instant',
  'hourly',
  'daily_morning',
  'daily_evening',
]);

export interface NotificationPrefsInput {
  channelsEnabled: ChannelsEnabled;
  kindsDisabled: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  digestMode: DigestMode;
}

export interface NotificationPrefsState extends NotificationPrefsInput {
  updatedAt: string | null;
}

const DEFAULT_CHANNELS: ChannelsEnabled = {
  in_app: true,
  whatsapp: true,
  email: true,
  push: true,
};

function isHhmm(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function normalizeChannels(value: unknown): ChannelsEnabled {
  const v = (value ?? {}) as Partial<Record<Channel, unknown>>;
  return {
    in_app: v.in_app !== false,
    whatsapp: v.whatsapp !== false,
    email: v.email !== false,
    push: v.push !== false,
  };
}

export async function getNotificationPreferences(): Promise<NotificationPrefsState | null> {
  const session = await getSessionContext();
  if (!session) return null;
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.userId))
    .limit(1);
  if (!row) {
    return {
      channelsEnabled: DEFAULT_CHANNELS,
      kindsDisabled: [],
      quietHoursStart: null,
      quietHoursEnd: null,
      digestMode: 'instant',
      updatedAt: null,
    };
  }
  return {
    channelsEnabled: normalizeChannels(row.channelsEnabled),
    kindsDisabled: row.kindsDisabled,
    quietHoursStart: row.quietHoursStart ?? null,
    quietHoursEnd: row.quietHoursEnd ?? null,
    digestMode: (row.digestMode as DigestMode) ?? 'instant',
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateNotificationPreferences(
  input: NotificationPrefsInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: 'unauthorized' };

  if (!VALID_DIGEST_MODES.has(input.digestMode)) {
    return { ok: false, error: 'invalid_digest_mode' };
  }
  if (input.quietHoursStart !== null && !isHhmm(input.quietHoursStart)) {
    return { ok: false, error: 'invalid_quiet_start' };
  }
  if (input.quietHoursEnd !== null && !isHhmm(input.quietHoursEnd)) {
    return { ok: false, error: 'invalid_quiet_end' };
  }

  const channels = normalizeChannels(input.channelsEnabled);
  const kinds = Array.from(new Set(input.kindsDisabled.filter((k) => typeof k === 'string')));

  await db
    .insert(notificationPreferences)
    .values({
      userId: session.userId,
      channelsEnabled: channels,
      kindsDisabled: kinds,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
      digestMode: input.digestMode,
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        channelsEnabled: channels,
        kindsDisabled: kinds,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
        digestMode: input.digestMode,
        updatedAt: new Date(),
      },
    });

  revalidatePath('/app/settings/notifications');
  return { ok: true };
}

export type TestChannel = 'in_app' | 'whatsapp' | 'email' | 'push';

export async function sendTestNotification(
  channel: TestChannel,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: 'unauthorized' };

  if (!VALID_CHANNELS.includes(channel)) {
    return { ok: false, error: 'invalid_channel' };
  }

  // Write an in-app row so the dispatcher fans out via the user's preferences.
  const { db, notifications } = await import('@zameen/db');
  await db.insert(notifications).values({
    recipientId: session.userId,
    channel,
    category: 'testNotification',
    title: 'Zameen test notification',
    body: `This is a test ${channel} notification you triggered from settings.`,
  });

  return { ok: true };
}
