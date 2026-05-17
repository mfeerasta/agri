/**
 * Native push registration. Requests permission, registers with APNS / FCM,
 * then POSTs the token to the existing /api/push/subscribe endpoint with
 * `platform = 'ios' | 'android'`. The server stores the token in
 * `native_token` and leaves `endpoint`/`p256dh`/`auth` null.
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { isNative, platform } from './index';

export interface RegisterResult {
  token: string;
}

const SUBSCRIBE_PATH = '/api/push/subscribe';

export async function registerForPush(app: 'field' | 'ops' = 'field'): Promise<RegisterResult> {
  if (!isNative()) {
    throw new Error('push-native-only');
  }
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    throw new Error('push-permission-denied');
  }
  await PushNotifications.register();

  const token = await new Promise<string>((resolve, reject) => {
    const ok = PushNotifications.addListener('registration', (t) => {
      ok.then((l) => l.remove()).catch(() => undefined);
      err.then((l) => l.remove()).catch(() => undefined);
      resolve(t.value);
    });
    const err = PushNotifications.addListener('registrationError', (e) => {
      ok.then((l) => l.remove()).catch(() => undefined);
      err.then((l) => l.remove()).catch(() => undefined);
      reject(new Error(e.error));
    });
  });

  await fetch(SUBSCRIBE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      app,
      platform: platform(),
      nativeToken: token,
    }),
  });

  return { token };
}
