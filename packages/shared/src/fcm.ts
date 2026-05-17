/**
 * Firebase Cloud Messaging (HTTP v1) client. Sends to a single device token
 * for either Android (native FCM) or iOS (APNS bridged through FCM).
 *
 * Authentication uses an OAuth2 access token minted from the service-account
 * JSON pointed at by FCM_SERVICE_ACCOUNT_JSON. For low-volume Zameen usage,
 * we mint a fresh token per minute. In tighter environments swap for a
 * cached token with TTL.
 */

import type { PushPayload } from './push';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export interface FcmServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface FcmSendResult {
  ok: boolean;
  statusCode: number;
  error?: string;
  messageId?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): FcmServiceAccount {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON not configured');
  }
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as FcmServiceAccount).client_email !== 'string' ||
    typeof (parsed as FcmServiceAccount).private_key !== 'string' ||
    typeof (parsed as FcmServiceAccount).project_id !== 'string'
  ) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON shape invalid');
  }
  return parsed as FcmServiceAccount;
}

async function mintAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const jwt = await signJwt(header, claim, sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`fcm-token-mint-failed:${res.status}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error('fcm-token-mint-no-token');
  }
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function signJwt(
  header: Record<string, string>,
  claim: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const { createSign } = await import('node:crypto');
  const b64url = (input: string | Buffer): string =>
    Buffer.from(input).toString('base64').replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKeyPem);
  return `${signingInput}.${b64url(signature)}`;
}

export async function sendFcmToToken(
  nativeToken: string,
  platform: 'ios' | 'android',
  payload: PushPayload,
): Promise<FcmSendResult> {
  let accessToken: string;
  let projectId: string;
  try {
    accessToken = await mintAccessToken();
    projectId = loadServiceAccount().project_id;
  } catch (e) {
    return {
      ok: false,
      statusCode: 0,
      error: e instanceof Error ? e.message : 'fcm-auth-failed',
    };
  }

  const message: Record<string, unknown> = {
    token: nativeToken,
    notification: { title: payload.title, body: payload.body },
    data: {
      deepLink: payload.deepLink,
      tag: payload.tag ?? '',
      badge: payload.badge != null ? String(payload.badge) : '',
    },
  };
  if (platform === 'android') {
    message.android = {
      priority: payload.priority === 'high' ? 'HIGH' : 'NORMAL',
      notification: {
        tag: payload.tag,
        click_action: payload.deepLink,
      },
    };
  } else {
    message.apns = {
      headers: {
        'apns-priority': payload.priority === 'high' ? '10' : '5',
      },
      payload: {
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: 'default',
          badge: payload.badge ?? 0,
          'thread-id': payload.tag,
        },
      },
    };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message }),
    },
  );

  if (res.ok) {
    const json = (await res.json()) as { name?: string };
    return { ok: true, statusCode: res.status, messageId: json.name };
  }

  let errorText = `fcm-http-${res.status}`;
  try {
    const body = (await res.json()) as { error?: { status?: string; message?: string } };
    if (body.error?.status) errorText = body.error.status;
    if (body.error?.message) errorText = `${errorText}:${body.error.message}`;
  } catch {
    /* swallow */
  }
  return { ok: false, statusCode: res.status, error: errorText };
}
