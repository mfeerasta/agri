# Mobile release runbook

One-page operational guide for the Capacitor shells `mobile-field` and `mobile-ops`. Each shell wraps the live PWA; native builds exist only to provide TestFlight + Play Console distribution, push notifications, native camera, GPS, and offline detection.

## Apps

| App | Bundle / Package | iOS workflow | Android workflow |
|---|---|---|---|
| Zameen Field | `ai.feerasta.zameen.field` | `.github/workflows/mobile-field-ios.yml` | `.github/workflows/mobile-field-android.yml` |
| Zameen Ops | `ai.feerasta.zameen.ops` | `.github/workflows/mobile-ops-ios.yml` | `.github/workflows/mobile-ops-android.yml` |

## Release flow

1. Land mobile changes on `main` with a commit prefix like `mobile(field): ...` or `mobile(ops,feat): ...`. Use `mobile(field)!:` for breaking.
2. `mobile-version-bump` opens a PR that bumps `package.json`, `capacitor.config.ts`, `android/app/build.gradle`, and `ios/App/App.xcodeproj/project.pbxproj`.
3. Review and merge the bump PR.
4. Cut the tag:
   - `git tag mobile-field-vX.Y.Z && git push origin mobile-field-vX.Y.Z`
   - `git tag mobile-ops-vX.Y.Z && git push origin mobile-ops-vX.Y.Z`
5. iOS and Android workflows trigger from the tag, build, sign, upload symbols to Sentry, and push to TestFlight + Play Console internal track.
6. Verify the build in App Store Connect (TestFlight tab) and Play Console (internal testing).

## Required secrets

Configure in GitHub repo settings.

### iOS
- `IOS_DIST_CERT_P12` — base64 of the Apple distribution certificate `.p12`.
- `IOS_DIST_CERT_PASSWORD`
- `IOS_PROVISION_PROFILE` — base64 of the field app provisioning profile.
- `IOS_PROVISION_PROFILE_OPS` — base64 of the ops app provisioning profile.
- `IOS_TEAM_ID`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY` — base64 of the `.p8` key.

### Android
- `ANDROID_KEYSTORE_BASE64` — base64 of `upload.jks`.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — raw JSON for the Play Console service account.

### Sentry
- `SENTRY_AUTH_TOKEN`
- `SENTRY_DSN_MOBILE_FIELD`
- `SENTRY_DSN_MOBILE_OPS`

## Local dev shortcuts

```bash
./scripts/mobile-dev.sh field             # start PWA + QR for phone scan
./scripts/mobile-dev.sh ops --live        # live-reload native build (Android)
./scripts/mobile-dev.sh field --ios       # one-shot sync + open Xcode
```

## Cert renewal checklist

Run this 30 days before any cert or profile expiry.

- [ ] Apple: regenerate distribution cert in developer.apple.com if expiring.
- [ ] Apple: regenerate provisioning profiles for `ai.feerasta.zameen.field` and `.ops`.
- [ ] Apple: rotate App Store Connect API key (yearly).
- [ ] Android: confirm `upload.jks` is backed up to 1Password and Soneri Bank safe deposit.
- [ ] Android: rotate Play Console service account JSON.
- [ ] Update GitHub secrets above with new base64 blobs.
- [ ] Run `gh workflow run mobile-field-ios.yml` and `mobile-ops-ios.yml` against `main` to confirm signing still works.

## Rollback procedure

If a build is bad and already on TestFlight or Play internal track:

1. Mark the prior build as the default in App Store Connect (Builds tab) and Play Console (Internal testing track).
2. Communicate via WhatsApp Director group with the build number and timestamp.
3. Cut a patch tag `mobile-field-vX.Y.Z+1` reverting to the prior PWA URL (`server.url` in `capacitor.config.ts`) if a hot-fix is needed.
4. File a Sentry issue link in the post-mortem.

## Crashlytics and Sentry

- Sentry is the primary error tracker. DSN is read from env at runtime (`process.env.SENTRY_DSN`).
- Source maps and dSYMs are uploaded as part of each iOS/Android workflow.
- Crashlytics is not wired (deliberate — single tool, Sentry covers both platforms).

## Store submission checklist

### App Store (TestFlight to public)

- [ ] Screenshots for 6.7", 6.5", 5.5" iPhone (use store-metadata/screenshots).
- [ ] App Review notes: "Field worker app for Pakistan agriculture operation. Demo login: pilot@agri.feerasta.ai / Demo1234!"
- [ ] Privacy nutrition: location, camera, photo library, contact info — collected, linked to user, app functionality.
- [ ] Export compliance: uses standard HTTPS encryption, no custom crypto.

### Play Console (internal to production)

- [ ] Targeted to API 34, min API 24.
- [ ] Data safety form: location, camera, contacts — required, encrypted in transit.
- [ ] Content rating: Everyone.
- [ ] Sign-up info for review with the demo creds above.
