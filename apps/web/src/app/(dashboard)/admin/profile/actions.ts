'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users } from '@zameen/db';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const channelSchema = z.enum(['in_app', 'whatsapp', 'push', 'email']);

const prefsSchema = z.object({
  approvalSubmitted: z.array(channelSchema),
  approvalDecided: z.array(channelSchema),
  mention: z.array(channelSchema),
  anomalyDetected: z.array(channelSchema),
  escalationReminder: z.array(channelSchema),
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
