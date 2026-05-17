/**
 * Origin-header CSRF guard for bespoke API routes. Server Actions are
 * already protected by Next.js encrypted action IDs; this is for our own
 * route handlers (sync, uploads, notifications, push, ocr, ai, webauthn).
 *
 * Strategy: require Origin or Referer to match one of the configured app URLs.
 * All Zameen clients are same-origin SPAs; cross-origin requests are rejected.
 */

export class CsrfError extends Error {
  readonly status = 403 as const;
  constructor(message: string) {
    super(message);
    this.name = 'CsrfError';
  }
}

function allowedOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_FIELD_URL,
    process.env.NEXT_PUBLIC_OPS_URL,
    process.env.NEXT_PUBLIC_APPROVE_URL,
  ]
    .filter((u): u is string => Boolean(u))
    .map((u) => u.replace(/\/$/, ''));
}

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin') ?? req.headers.get('referer');
  if (!origin) throw new CsrfError('Missing Origin');
  const allowed = allowedOrigins();
  if (allowed.length === 0) {
    // Dev fallback: allow localhost.
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return;
    }
    throw new CsrfError('No allowed origins configured');
  }
  if (!allowed.some((u) => origin.startsWith(u))) {
    throw new CsrfError('Origin not allowed');
  }
}

export function withCsrf<T>(handler: (req: Request) => Promise<T>): (req: Request) => Promise<T | Response> {
  return async (req: Request) => {
    try {
      assertSameOrigin(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'forbidden';
      return new Response(JSON.stringify({ error: message }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
    return handler(req);
  };
}
