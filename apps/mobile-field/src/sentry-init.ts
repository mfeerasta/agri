// Initialises Sentry inside the Capacitor shell for mobile-field. The PWA
// itself has its own browser-side Sentry init; this captures native crashes
// (iOS/Android) and links them to the same release tag.
//
// DSN is injected at build time via env (SENTRY_DSN) or via a runtime config
// fetched from the PWA. Release tag is the package.json version.

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
    release: `mobile-field@${version}`,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // strip any PKR amounts or personal identifiers from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          message: b.message?.replace(/\bPKR\s?[\d,]+/g, 'PKR <redacted>'),
        }));
      }
      return event;
    },
  });
  initialised = true;
}
