// Initialises Sentry inside the Capacitor shell for mobile-ops. Mirrors the
// mobile-field init; differs only in the release tag.

import * as Sentry from '@sentry/capacitor';
import { version } from '../package.json';

let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  const dsn = (globalThis as { SENTRY_DSN?: string }).SENTRY_DSN ?? process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[sentry] no DSN set; skipping init');
    return;
  }
  Sentry.init({
    dsn,
    release: `mobile-ops@${version}`,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
  initialised = true;
}
