/**
 * Shared security headers + per-app CSP composition for the Zameen apps.
 * Used inside middleware to harden every response.
 */

import type { NextResponse } from 'next/server';

export type AppName = 'web' | 'field' | 'ops' | 'approve';

interface CspOptions {
  needsMapbox: boolean;
  needsServiceWorker: boolean;
  needsSentinelHub: boolean;
}

const SUPABASE_HOST = 'https://*.supabase.co';
const SUPABASE_WS = 'wss://*.supabase.co';
const MAPBOX_HOSTS = 'https://api.mapbox.com https://events.mapbox.com';
const SENTINEL_HOST = 'https://services.sentinel-hub.com';
const AI_HOSTS = 'https://api.anthropic.com https://api.openai.com';

function buildCsp(options: CspOptions): string {
  const connect = [
    "'self'",
    SUPABASE_HOST,
    SUPABASE_WS,
    AI_HOSTS,
    options.needsMapbox ? MAPBOX_HOSTS : '',
    options.needsSentinelHub ? SENTINEL_HOST : '',
  ]
    .filter(Boolean)
    .join(' ');

  const script = [
    "'self'",
    "'unsafe-inline'",
    options.needsMapbox ? 'https://api.mapbox.com' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src ${connect}`,
    options.needsServiceWorker ? "worker-src 'self' blob:" : "worker-src 'self'",
    "manifest-src 'self'",
  ];

  return directives.join('; ');
}

const APP_OPTIONS: Record<AppName, CspOptions> = {
  web: { needsMapbox: true, needsServiceWorker: false, needsSentinelHub: true },
  field: { needsMapbox: false, needsServiceWorker: true, needsSentinelHub: false },
  ops: { needsMapbox: true, needsServiceWorker: false, needsSentinelHub: true },
  approve: { needsMapbox: false, needsServiceWorker: true, needsSentinelHub: false },
};

export function applySecurityHeaders(response: NextResponse, app: AppName): NextResponse {
  const csp = buildCsp(APP_OPTIONS[app]);
  // Phase 1: report-only mode. Once the violation log shows no legit traffic
  // for one week, flip the header name to `Content-Security-Policy`.
  response.headers.set(
    'Content-Security-Policy-Report-Only',
    `${csp}; report-uri /api/csp-report`,
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()',
  );
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  return response;
}
