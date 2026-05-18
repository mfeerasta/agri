/**
 * Recursive redaction utility for logs. Strips known sensitive keys and any
 * long token-shaped values so structured logs can be safely forwarded to
 * Loki, journald, or stdout without leaking credentials or PII.
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'apiKey',
  'secret',
  'serviceRoleKey',
  'cnic',
  'cnicEncrypted',
  'p256dh',
  'auth',
  'nativeToken',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'vapidPrivateKey',
  'cnicKey',
  'serviceAccountJson',
];

export function redact(obj: unknown, depth = 0): unknown {
  if (depth > 6) return '[max-depth]';
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const kl = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => kl.includes(s.toLowerCase()))) {
      out[k] = '[redacted]';
    } else if (typeof v === 'string' && v.length > 100 && /^[A-Za-z0-9._=+/-]+$/.test(v)) {
      out[k] = `[redacted-tokenish-${v.length}]`;
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(redact(obj));
  } catch {
    return '[unserializable]';
  }
}
