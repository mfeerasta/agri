/**
 * Field PWA security headers. PWA needs service worker + blob workers; no
 * Mapbox in field UI yet but allow Sentinel for offline NDVI tiles in future.
 */

import type { NextResponse } from 'next/server';

export function applyFieldSecurityHeaders(response: NextResponse): NextResponse {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.openai.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');

  // Report-only first; flip to enforced after a week of clean reports.
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
  return response;
}
