/**
 * Web Push fan-out. Wraps the `web-push` library with a Zameen-shaped API.
 *
 * VAPID keys come from env. The private key is never logged. Subscriptions
 * that respond with 404/410 are gone for good and get deleted; other failures
 * bump a counter and trigger deletion after three strikes.
 */

import webpush from 'web-push';
import { and, eq } from 'drizzle-orm';
import { db, pushSubscriptions } from '@zameen/db';
import { sendFcmToToken } from './fcm.js';

export interface PushPayload {
  title: string;
  body: string;
  deepLink: string;
  badge?: number;
  tag?: string;
  icon?: string;
  priority?: 'normal' | 'high';
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushApp = 'web' | 'field' | 'ops' | 'approve' | 'any';

interface PushOk {
  ok: true;
}
interface PushErr {
  ok: false;
  statusCode: number;
  error: string;
}
export type SendResult = PushOk | PushErr;

let vapidInitialized = false;

function initVapid(): void {
  if (vapidInitialized) return;
  const publicKey = process.env.ZAMEEN_VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_ZAMEEN_VAPID_PUBLIC_KEY;
  const privateKey = process.env.ZAMEEN_VAPID_PRIVATE_KEY;
  const subject = process.env.ZAMEEN_VAPID_SUBJECT ?? 'mailto:notifications@agri.feerasta.ai';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
}

export async function sendPush(
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
): Promise<SendResult> {
  try {
    initVapid();
  } catch (e) {
    return { ok: false, statusCode: 0, error: e instanceof Error ? e.message : 'vapid_init_failed' };
  }
  const body = JSON.stringify(payload);
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      body,
      {
        TTL: 60 * 60 * 24,
        urgency: payload.priority === 'high' ? 'high' : 'normal',
      },
    );
    return { ok: true };
  } catch (e) {
    const statusCode = typeof (e as { statusCode?: unknown }).statusCode === 'number'
      ? (e as { statusCode: number }).statusCode
      : 0;
    const message = e instanceof Error ? e.message : 'push_failed';
    return { ok: false, statusCode, error: message };
  }
}

async function pruneOrPenalize(rowId: string, result: PushErr): Promise<void> {
  const fcmGone =
    result.error?.startsWith('UNREGISTERED') ||
    result.error?.startsWith('INVALID_ARGUMENT') ||
    result.error?.startsWith('NOT_FOUND');
  if (result.statusCode === 404 || result.statusCode === 410 || fcmGone) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, rowId));
    return;
  }
  const [row] = await db
    .select({ failureCount: pushSubscriptions.failureCount })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.id, rowId))
    .limit(1);
  const current = Number(row?.failureCount ?? 0);
  const next = current + 1;
  if (next >= 3) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, rowId));
    return;
  }
  await db
    .update(pushSubscriptions)
    .set({ failureCount: next })
    .where(eq(pushSubscriptions.id, rowId));
}

export async function sendPushToUser(
  userId: string,
  app: PushApp,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const filter = app === 'any'
    ? eq(pushSubscriptions.userId, userId)
    : and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.app, app));

  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      platform: pushSubscriptions.platform,
      nativeToken: pushSubscriptions.nativeToken,
    })
    .from(pushSubscriptions)
    .where(filter);

  if (rows.length === 0) return { sent: 0, failed: 0 };

  const settled = await Promise.allSettled(
    rows.map(async (row) => {
      let r: SendResult;
      if (row.platform === 'ios' || row.platform === 'android') {
        if (!row.nativeToken) {
          r = { ok: false, statusCode: 0, error: 'missing-native-token' };
        } else {
          const fcm = await sendFcmToToken(row.nativeToken, row.platform, payload);
          r = fcm.ok
            ? { ok: true }
            : { ok: false, statusCode: fcm.statusCode, error: fcm.error ?? 'fcm-failed' };
        }
      } else if (row.endpoint && row.p256dh && row.auth) {
        r = await sendPush(
          { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
          payload,
        );
      } else {
        r = { ok: false, statusCode: 0, error: 'web-row-missing-keys' };
      }
      if (r.ok) {
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date(), failureCount: 0 })
          .where(eq(pushSubscriptions.id, row.id));
      } else {
        await pruneOrPenalize(row.id, r);
      }
      return r;
    }),
  );

  let sent = 0;
  let failed = 0;
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
