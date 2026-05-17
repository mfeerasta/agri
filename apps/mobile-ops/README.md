# Zameen Ops — Capacitor tablet shell

Tablet-optimised native shell that wraps `https://ops.agri.feerasta.ai` for
iPad and Galaxy Tab. Same architecture as `apps/mobile-field` (server.url
mode, native bridge for camera + push + offline + GPS) but a different
`appId` and a target form-factor of tablet.

## One-time local setup

```bash
cd apps/mobile-ops
pnpm install
pnpm run build:bridge
npx cap add ios
npx cap add android
npx cap sync
```

## Day-to-day

```bash
pnpm run sync
pnpm run ios       # opens Xcode
pnpm run android   # opens Android Studio
```

## Tablet defaults

- iPad: portrait + landscape, supports Stage Manager
- Galaxy Tab: portrait + landscape, supports split-screen
- Configure tablet-only entitlements in the generated `ios/` and `android/`
  projects (not committed)
