# Zameen Field — Capacitor shell

Native iOS + Android shell that wraps the production field PWA at
`https://field.agri.feerasta.ai`. Capacitor runs in `server.url` mode, so the
shell loads the live PWA inside a WKWebView (iOS) / WebView (Android) and
augments it with native camera, geolocation, push, and offline storage via
the bridge injected at startup.

The native shell adds zero build steps to the web PWA. Updates ship without a
store review by pushing to `field.agri.feerasta.ai`. The store build only
needs to change when native plugins, permissions, or signing change.

## One-time local setup

```bash
cd apps/mobile-field
pnpm install
pnpm run build:bridge

# Generate native projects (NOT committed — regenerate per machine)
npx cap add ios
npx cap add android
npx cap sync
```

## Day-to-day

```bash
# Sync web + plugin changes into both native projects
pnpm run sync

# Open in Xcode (iOS) — manual signing in Xcode for now
pnpm run ios

# Open in Android Studio
pnpm run android

# CLI release APK (Android only — used by CI)
pnpm run android:assemble
```

## Configuration

- `capacitor.config.ts` — appId, server URL, plugin presentation options
- `src/native/*` — typed wrappers exposed to the web layer as
  `window.__zameenNative__` via `src/bridge/inject.ts`
- `src/bridge/inject.ts` — runs inside the WebView on `DOMContentLoaded`
  and installs the native bridge on `window`
- `store-metadata/` — App Store + Play Store listings, icons, privacy policy

## Permissions

| Permission       | Why                                                            |
|------------------|----------------------------------------------------------------|
| Camera           | Diesel receipt photos, repair issue photos, NDVI ground truth  |
| Photo library    | Re-pick previously taken photos when offline queue is replayed |
| Location (FG/BG) | GPS-stamped diesel logs and field entries                      |
| Push             | Approval-needed and overdue-task notifications                 |
| Network access   | Online detection for the offline-queue replayer                |

## Privacy

See `store-metadata/privacy-policy.md` and `store-metadata/terms-of-service.md`.
