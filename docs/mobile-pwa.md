# Mobile PWA, design and architecture

This document covers the Field PWA at `field.agri.feerasta.ai` and the Approver PWA at `approve.agri.feerasta.ai`. Both are Next.js 15 PWAs, installable, offline-capable, and built for low-end Android phones on prepaid data.

## Design principles

1. **64px minimum tap target.** Field workers wear gloves and use thumbs. Every primary action button is at least 64 by 64 CSS pixels, with at least 8 px of separation from adjacent interactive elements. The `<BigButton />` component in `@zameen/ui` enforces this.
2. **Urdu RTL primary.** The Field PWA boots in `lang="ur" dir="rtl"`. The shell mirrors completely. English is a secondary toggle, never a fallback. Numbers and timestamps stay LTR inside RTL containers (see localization rules).
3. **Voice on every text field.** Every input that accepts free-text Urdu (comments, names, vendor, notes) carries a microphone icon. Phase 1 uses the browser's `SpeechRecognition` API with Urdu language hint. Phase 3 replaces with a Whisper-class on-device or server-side STT.
4. **Photo-first flows.** For diesel purchase, repair request, repair invoice, and crop stage logs, the photo capture step precedes the form. The form is pre-populated where possible (vendor name OCR is Phase 3; for now the worker confirms).
5. **One decision per screen.** No multi-purpose screens for workers. The Supervisor and Manager surfaces allow multi-step flows; the Worker surface does not.
6. **No modals on the worker path.** Modals do not survive page reloads on flaky networks. The Field PWA uses full-page transitions only.

## Offline architecture

The Field PWA assumes the network is unreliable. The default is offline-capable, online-augmented.

```
                ┌──────────────────────────────┐
                │   React UI (Field PWA)       │
                └──────────────┬───────────────┘
                               │ writes
                               ▼
                ┌──────────────────────────────┐
                │   IndexedDB offline queue    │
                │   (idb-keyval, per-entity)   │
                └──────────────┬───────────────┘
                               │ drain on 'online'
                               ▼
                ┌──────────────────────────────┐
                │   Service worker (Workbox)   │
                │   NetworkFirst on /api/*     │
                │   CacheFirst on static       │
                └──────────────┬───────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │   Server actions / RPCs      │
                └──────────────────────────────┘
```

The queue is keyed by entity and action type. Each queued mutation carries an `idempotencyKey` (UUID v7 with timestamp prefix) so the server-side action can dedupe. On `online` event the drainer sends queued items in FIFO order, with exponential backoff on failure and a hard ceiling of 7 retries before flagging the item for human review.

### Conflict resolution

Two rules.

1. **Non-financial mutations: last-write-wins.** Attendance, crop stage logs, asset hour-meter readings, photo uploads. The server overwrites with the latest payload by `submitted_at` and logs the prior value into `audit_log`.
2. **Financial mutations: manual review required.** Diesel purchase, repair invoice, cost allocation, journal posting. If the server detects a duplicate idempotency key with a divergent payload, it rejects the second submission with `code: 'duplicate-divergent'` and surfaces the request in the Ops dashboard for the Accountant to resolve.

The Approver PWA does not write financial mutations directly; it only writes `approval_actions` rows, which are append-only by RLS policy. No conflict resolution needed.

## Battery awareness

Field workers use shared phones for an entire shift. The PWA reduces drain.

- Battery API (`navigator.getBattery()`) is polled at app boot and on visibility change.
- Below 20 percent: GPS is captured once on form submit rather than continuously, photo compression target drops from 1600 px long edge to 1200 px, non-critical sync (cached image prefetches) is deferred.
- Below 10 percent: a warning banner appears in red and prompts the worker to plug in or hand off the device.

## Photo pipeline

Photos are captured with the camera input (`<input type="file" capture="environment">`) on the worker path and with the standard file picker on the management path.

Client-side pipeline:

1. Capture file from `<input>`.
2. Decode to `ImageBitmap`.
3. Resize so the long edge is at most 1600 px (defined in `PHOTO_TARGET_LONG_EDGE_PX`).
4. Re-encode to JPEG at quality 0.8.
5. Verify final size is under 200 KB (`PHOTO_MAX_BYTES`). If still over, drop quality to 0.7 and retry once.
6. Request a presigned PUT URL from a server action: `POST /api/r2/presign` with `{ entityId, module, contentType }`. The server returns `{ url, key, expiresAt }`.
7. PUT the JPEG bytes to R2 directly.
8. Store the resulting URL on the form payload.

R2 storage is keyed `entities/<entityId>/<module>/<yyyy>/<mm>/<uuid>.jpg`. Lifecycle policy moves objects to Infrequent Access at 90 days. Public access is blocked; reads are served via signed GET URLs with a 1-hour TTL or a Cloudflare Worker that authorises against the session.

## GPS handling

GPS is captured at submission, not continuously.

- On form submit, call `navigator.geolocation.getCurrentPosition` with `{ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }`.
- If `accuracy > 50 m`, retry once with `enableHighAccuracy: true` and a fresh attempt.
- If the second attempt is still beyond 50 m, submit with the best available reading and flag the row `gpsAccuracyDegraded: true`.
- If permission is denied, allow the submission but flag `gpsConsent: false`. Supervisor receives a daily summary of denied-GPS submissions.

The Approver PWA captures the approver's GPS at decision time and writes it to `approval_actions.gps_location`. This is the platform's anti-fraud floor: an approval claimed to happen at Rupafab Agri (Raiwind Farm) that is recorded from Lisbon shows up immediately on audit.

## Sync status indicator

A persistent dot in the top-right corner of every screen.

- Green: online, queue empty, last sync under 60 seconds ago.
- Yellow: online but queue has unflushed items, or offline and queue under 5 items.
- Red: offline with queue over 5 items, or any item in retry-exhausted state.

Tapping the dot opens a panel listing queued items with their state and a manual retry control.

## PWA install prompt strategy

The default browser install prompt is suppressed and replaced with a contextual prompt.

- First open: never prompt.
- After the user successfully submits two forms: show a slim banner offering "Install Zameen for offline use". One dismissal hides it for 30 days.
- On the Approver PWA, the prompt appears after the first successful approval decision.

The install banner uses `beforeinstallprompt` and is gated on `display-mode: browser` (not already installed) and an `entity_settings.pwa_install_prompt_enabled` flag for the tenant.

## Permission requests, just-in-time

Permissions are requested only at the moment of first need, never at app boot.

- **Camera.** On first tap of a photo capture button. If denied, the form falls back to a file picker that allows gallery selection but flags the row `cameraConsent: false`.
- **Geolocation.** On first form submit that requires GPS. The platform never prompts for location without an active user action.
- **Microphone.** On first tap of a voice input button. If denied, the field falls back to text-only with no warning loop.
- **Notifications.** Only on the Approver PWA, and only after the user has made at least one decision. Workers do not receive push.

Each denied permission is surfaced in user settings with a re-request control.

## Performance budgets

- First contentful paint on a Redmi 8A (Snapdragon 439, 3G throttled): under 2.5 seconds, cold.
- Time to interactive on the home screen: under 4 seconds, cold; under 800 ms, warm.
- Service worker precache: under 1.5 MB compressed total.
- Per-screen JS payload: under 80 KB gzipped above the shared shell.
- Photo capture-to-queued: under 3 seconds end to end at 1600 px target.

## Accessibility

- Touch targets meet WCAG 2.5.5 (44 px minimum, 64 px on this platform).
- Colour contrast at AAA for body text on the worker path.
- All form fields have visible labels (no placeholder-as-label).
- Voice control is a feature, not an accessibility afterthought; it carries the same weight as touch.
- Screen reader labels are bilingual via `aria-label` keyed on the active locale.

## Telemetry

Phase 1 telemetry is minimal and opt-in.

- Sync queue depth and drain latency.
- Photo upload success rate.
- Form submission to GPS-capture latency.
- Crash and unhandled rejection (Sentry, scoped by entity).

No worker-level behavioural tracking. The platform's audit log is the only authoritative actor record.
