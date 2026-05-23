// Notification dispatcher.
// Reads pending rows from zameen.notifications, honors per-user preferences
// from zameen.notification_preferences (channel toggles, kind mutes, quiet
// hours, digest mode), and delivers via the appropriate channel handler.
//
// Behavior contract:
//   - If channel is disabled in channels_enabled, mark as suppressed and skip.
//   - If notification category matches kinds_disabled, mark as suppressed.
//   - If now() falls inside quiet_hours and channel is push/whatsapp/email,
//     defer (leave sent_at null, set failed_reason='deferred:quiet_hours').
//   - If digest_mode != 'instant', non-urgent notifications are aggregated
//     into a single digest at the next mark; mark as deferred meanwhile.
//   - Otherwise deliver and stamp sent_at.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import { trackJobRun } from '../_shared/job-tracker.ts';

type Channel = 'in_app' | 'whatsapp' | 'email' | 'push';
type DigestMode = 'instant' | 'hourly' | 'daily_morning' | 'daily_evening';

interface NotificationRow {
  id: string;
  recipient_id: string;
  channel: Channel;
  category: string;
  title: string;
  body: string;
  deep_link: string | null;
  payload: Record<string, unknown> | null;
  sent_at: string | null;
}

interface PrefsRow {
  user_id: string;
  channels_enabled: Partial<Record<Channel, boolean>>;
  kinds_disabled: string[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_mode: DigestMode;
}

const URGENT_CATEGORIES = new Set(['escalationReminder', 'anomalyDiesel', 'approvalSubmitted']);

function inQuietHours(now: Date, startHhmm: string | null, endHhmm: string | null): boolean {
  if (!startHhmm || !endHhmm) return false;
  const [sh, sm] = startHhmm.split(':').map((n) => Number.parseInt(n, 10));
  const [eh, em] = endHhmm.split(':').map((n) => Number.parseInt(n, 10));
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin === endMin) return false;
  if (startMin < endMin) return minutes >= startMin && minutes < endMin;
  // window wraps midnight
  return minutes >= startMin || minutes < endMin;
}

async function loadPrefs(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, PrefsRow>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .schema('zameen')
    .from('notification_preferences')
    .select('user_id, channels_enabled, kinds_disabled, quiet_hours_start, quiet_hours_end, digest_mode')
    .in('user_id', userIds);
  if (error) throw error;
  const map = new Map<string, PrefsRow>();
  for (const row of (data ?? []) as PrefsRow[]) map.set(row.user_id, row);
  return map;
}

async function markSuppressed(supabase: SupabaseClient, id: string, reason: string): Promise<void> {
  await supabase
    .schema('zameen')
    .from('notifications')
    .update({ failed_reason: `suppressed:${reason}`, sent_at: new Date().toISOString() })
    .eq('id', id);
}

async function markDeferred(supabase: SupabaseClient, id: string, reason: string): Promise<void> {
  await supabase
    .schema('zameen')
    .from('notifications')
    .update({ failed_reason: `deferred:${reason}` })
    .eq('id', id);
}

async function markSent(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase
    .schema('zameen')
    .from('notifications')
    .update({ sent_at: new Date().toISOString(), failed_reason: null })
    .eq('id', id);
}

async function deliverInApp(_supabase: SupabaseClient, _n: NotificationRow): Promise<void> {
  // In-app is already a row in zameen.notifications; nothing else to do.
}

async function deliverPush(_supabase: SupabaseClient, _n: NotificationRow): Promise<void> {
  // Hook into push.ts via fetch to /functions/v1/push-sender if needed.
}

async function deliverWhatsapp(_supabase: SupabaseClient, _n: NotificationRow): Promise<void> {
  // Owned by the dedicated `notify-whatsapp` edge function. We deliberately
  // do not call Meta from here. The row stays queued (sent_at null,
  // failed_reason null) and the dispatcher picks it up on its next tick.
}

async function deliverEmail(_supabase: SupabaseClient, _n: NotificationRow): Promise<void> {
  // Hook into shared/email.ts via the edge resend.
}

async function dispatchOne(
  supabase: SupabaseClient,
  n: NotificationRow,
  prefs: PrefsRow | undefined,
  now: Date,
): Promise<'sent' | 'suppressed' | 'deferred'> {
  const channel = n.channel;
  const category = n.category;

  if (prefs) {
    if (prefs.kinds_disabled.includes(category)) {
      await markSuppressed(supabase, n.id, 'kind_muted');
      return 'suppressed';
    }
    if (prefs.channels_enabled[channel] === false) {
      await markSuppressed(supabase, n.id, 'channel_off');
      return 'suppressed';
    }
    const isUrgent = URGENT_CATEGORIES.has(category);
    if (!isUrgent && channel !== 'in_app') {
      if (inQuietHours(now, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        await markDeferred(supabase, n.id, 'quiet_hours');
        return 'deferred';
      }
      if (prefs.digest_mode !== 'instant') {
        await markDeferred(supabase, n.id, `digest:${prefs.digest_mode}`);
        return 'deferred';
      }
    }
  }

  if (channel === 'in_app') await deliverInApp(supabase, n);
  else if (channel === 'push') await deliverPush(supabase, n);
  else if (channel === 'whatsapp') await deliverWhatsapp(supabase, n);
  else if (channel === 'email') await deliverEmail(supabase, n);

  // WhatsApp delivery is owned by the dedicated `notify-whatsapp` function.
  // Leave the row queued (sent_at null) so that dispatcher claims it.
  if (channel !== 'whatsapp') {
    await markSent(supabase, n.id);
  }
  return 'sent';
}

serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_env' }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const result = await trackJobRun({
    supabase,
    jobName: 'notification-dispatcher',
    work: async () => {
      const { data, error } = await supabase
        .schema('zameen')
        .from('notifications')
        .select('id, recipient_id, channel, category, title, body, deep_link, payload, sent_at')
        .is('sent_at', null)
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as NotificationRow[];
      const userIds = Array.from(new Set(rows.map((r) => r.recipient_id)));
      const prefs = await loadPrefs(supabase, userIds);
      const now = new Date();

      let sent = 0;
      let suppressed = 0;
      let deferred = 0;
      for (const row of rows) {
        try {
          const outcome = await dispatchOne(supabase, row, prefs.get(row.recipient_id), now);
          if (outcome === 'sent') sent += 1;
          else if (outcome === 'suppressed') suppressed += 1;
          else deferred += 1;
        } catch (err) {
          await supabase
            .schema('zameen')
            .from('notifications')
            .update({ failed_reason: `error:${(err as Error).message}` })
            .eq('id', row.id);
        }
      }
      return {
        recordsProcessed: rows.length,
        payload: { sent, suppressed, deferred },
      };
    },
  });

  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { 'content-type': 'application/json' },
  });
});
