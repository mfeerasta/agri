/**
 * Origin-header CSRF guard for approve PWA API routes.
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
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return;
    throw new CsrfError('No allowed origins configured');
  }
  if (!allowed.some((u) => origin.startsWith(u))) {
    throw new CsrfError('Origin not allowed');
  }
}
