'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users, notifications } from '@zameen/db';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const channelSchema = z.enum(['in_app', 'whatsapp', 'email', 'push']);

const eventKeys = [
  'approvalSubmitted',
  'approvalDecided',
  'escalationReminder',
  'mention',
  'taskAssigned',
  'taskDueSoon',
  'taskOverdue',
  'anomalyDiesel',
  'anomalyWeather',
  'diagnosticFlagged',
  'digestDaily',
  'digestWeekly',
] as const;

const quietHoursSchema = z.object({
  enabled: z.boolean(),
  startHhmm: z.string().regex(/^\d{2}:\d{2}$/),
  endHhmm: z.string().regex(/^\d{2}:\d{2}$/),
});

const channelsArray = z.array(channelSchema);

const prefsSchema = z.object({
  approvalSubmitted: channelsArray,
  approvalDecided: channelsArray,
  escalationReminder: channelsArray,
  mention: channelsArray,
  taskAssigned: channelsArray,
  taskDueSoon: channelsArray,
  taskOverdue: channelsArray,
  anomalyDiesel: channelsArray,
  anomalyWeather: channelsArray,
  diagnosticFlagged: channelsArray,
  digestDaily: channelsArray,
  digestWeekly: channelsArray,
  quietHours: quietHoursSchema,
});

export type NotificationPrefs = z.infer<typeof prefsSchema>;

export async function updateNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = prefsSchema.safeParse(prefs);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: 'unauthenticated' };

  await db
    .update(users)
    .set({ notificationPrefs: parsed.data })
    .where(eq(users.id, data.user.id));
  return { ok: true };
}

const testChannelSchema = z.enum(['in_app', 'whatsapp', 'email', 'push']);

export async function sendTestNotification(
  channel: z.infer<typeof testChannelSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = testChannelSchema.safeParse(channel);
  if (!parsed.success) return { ok: false, error: 'invalid channel' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: 'unauthenticated' };

  const [me] = await db.select().from(users).where(eq(users.id, data.user.id)).limit(1);
  if (!me) return { ok: false, error: 'user not found' };

  const title = 'Zameen test notification';
  const body = `This is a test of your ${parsed.data.replace('_', '-')} channel. If you can see this, delivery works.`;

  try {
    if (parsed.data === 'in_app') {
      await db.insert(notifications).values({
        recipientId: me.id,
        entityId: me.defaultEntityId,
        channel: 'in_app',
        category: 'test',
        title,
        body,
        sentAt: new Date(),
      });
      return { ok: true };
    }

    if (parsed.data === 'whatsapp') {
      if (!me.phone) return { ok: false, error: 'no phone on profile' };
      const { sendTemplate } = await import('@zameen/shared');
      await sendTemplate({
        to: me.phone,
        templateName: 'test_ping',
        languageCode: me.preferredLocale === 'ur' ? 'ur' : 'en',
        parameters: [me.fullName],
      });
      return { ok: true };
    }

    if (parsed.data === 'email') {
      if (!me.email) return { ok: false, error: 'no email on profile' };
      const { Resend } = await import('resend');
      const client = new Resend(process.env.RESEND_API_KEY ?? '');
      await client.emails.send({
        from: process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>',
        to: me.email,
        subject: title,
        text: body,
      });
      return { ok: true };
    }

    if (parsed.data === 'push') {
      const { sendPushToUser } = await import('@zameen/shared');
      const result = await sendPushToUser(me.id, 'any', {
        title,
        body,
        tag: 'test',
        priority: 'normal',
      });
      if (result.sent === 0) return { ok: false, error: 'no active push subscription' };
      return { ok: true };
    }

    return { ok: false, error: 'unsupported channel' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
