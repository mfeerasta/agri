# ADR 0008, PWA over native mobile apps

Status: Accepted, 2026-04-22.

## Context

The Field PWA and the Approver PWA target mobile devices. Workers and supervisors at Rupafab Agri (Raiwind Farm) use low-end Android phones, predominantly Redmi 8A and Samsung Galaxy A-series, on prepaid data with 3G to flaky 4G coverage. MF as Director uses iPhone primarily, occasionally a personal Android. The platform needs camera, GPS, microphone, IndexedDB, service worker, push notifications, and offline form submission.

Three client-side technologies were considered.

First, a Progressive Web App. Single codebase shared with the management web. Installable via Add to Home Screen on Android Chrome. Full access to camera (via `<input type="file" capture="environment">`), GPS (via `navigator.geolocation`), microphone (via `getUserMedia`), IndexedDB, service worker (via Workbox), and push notifications on Android (FCM-backed). No store submission, instant updates. iOS install path is rougher (Safari only, no `beforeinstallprompt`).

Second, React Native. Cross-platform, single TypeScript codebase, near-native performance, full device API access. Requires separate build pipelines for Android and iOS, Play Store and App Store review on every release, code-signing infrastructure, and a team comfortable with the React Native runtime quirks. Sharing components with the Next.js apps requires a non-trivial abstraction layer.

Third, a Capacitor or Tauri wrapper around the PWA. Hybrid: web in a native shell. Adds plugin complexity for native APIs the PWA already covers, but gives store presence. Push on iOS is better than PWA push on iOS.

## Decision

The Field PWA and the Approver PWA are PWAs, not native or hybrid. They are Next.js 15 apps with a service worker built via Workbox, a manifest, and an install prompt strategy described in `docs/mobile-pwa.md`. Push notifications use the Web Push API on Android (FCM); on iOS we rely on email or WhatsApp deep-link until Apple's PWA push catches up.

The Approver PWA is the primary install target for MF on iOS. Apple's Add-to-Home-Screen path is documented in the onboarding flow with screenshots.

## Consequences

Positive. One codebase across the four apps. No store review on the worker update path; workers receive updates on next page load via service worker. Camera, GPS, microphone, IndexedDB, and offline queue all work on Android Chrome. Build pipeline is the same `pnpm build` that produces the standalone Next.js bundle. Onboarding is a URL, not a store search.

Negative. iOS install friction is real. The Approver PWA on iOS does not get a `beforeinstallprompt`; the user must use Safari's share menu and tap "Add to Home Screen." Mitigated by an onboarding guide and direct walk-through with MF. Push on iOS PWAs is limited (Safari supports Web Push as of iOS 16.4, but only for home-screen-installed PWAs). For Phase 1, MF receives a WhatsApp deep link instead.

Operational. Service worker updates can strand users on stale assets if cache invalidation is mishandled. Mitigated by Workbox's stale-while-revalidate strategy on shells and a hard-reload prompt on manifest version bump. The PWA install rate is measured as a Phase 1 KPI.

Workers and shared devices. PWAs share the device's browser session by default. The Field PWA implements a manual sign-out and a worker-switching screen that clears the session and reauthenticates with phone OTP. Acceptable for shared-phone scenarios.

Exit. If iOS push becomes critical and Web Push is insufficient, we wrap the Approver PWA in Capacitor for a TestFlight build distributed to MF only. The worker path stays PWA. The decision is not all-or-nothing.
