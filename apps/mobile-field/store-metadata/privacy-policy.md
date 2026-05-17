# Zameen Field — Privacy Policy

Last updated: 2026-05-17

Zameen Field is an internal application for Rupafab agricultural staff. It is
not intended for the general public. By installing and using the app, you
acknowledge the data practices described here.

## What we collect

1. **Account identifiers.** Your Rupafab user id, role, and phone number
   are used to authenticate you. We do not collect your CNIC inside the app
   (it is stored centrally with encryption at rest).
2. **Photos.** Photos you take through the app (diesel receipts, repair
   evidence, ground-truth crop photos) are uploaded to Cloudflare R2 and
   linked to the underlying record. Photos are compressed client-side to
   reduce data usage.
3. **Location.** Your device GPS is captured when you submit diesel logs,
   repair requests, and approval decisions. Latitude, longitude, and
   accuracy are stored on the record for audit. The app does not track
   you in the background.
4. **Device push token.** When you enable notifications, your FCM or APNS
   token is stored against your account and used only to deliver approval
   and task alerts.
5. **Diagnostic events.** Crash and error events may be captured via
   anonymous telemetry to keep the app stable.

## What we do not collect

- We do not sell or share your data with third parties.
- We do not run third-party ad SDKs.
- We do not access your contacts, calendar, microphone (other than the
  browser SpeechRecognition API when you opt-in for voice input), or
  files outside the photos you explicitly capture.

## Retention

Operational records (diesel logs, repair requests, approval actions) are
retained per Rupafab finance policy. Photos are retained for the lifetime
of the record. Push tokens are deleted when invalid (three consecutive
delivery failures or device unregister).

## Contact

Email: meerfeerasta@gmail.com
