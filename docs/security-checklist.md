# Zameen Pre-Pilot Security Checklist

Living document. Walk this before every pilot rollout and after any
material refactor of auth, finance, or upload paths.

## 1. SQL injection

- All DB access goes through Drizzle ORM with parameterised queries.
- No raw `db.execute(sql tag ...userInput...)` outside the rate-limit
  bucket helper (which only passes bound parameters).
- Verify with `rg "db\\.execute\\(" apps packages` — every match must use
  Drizzle template tags, never string concatenation.

## 2. Cross-site scripting (XSS)

- React escapes by default. No raw HTML injection without an
  explicit allowlist sanitiser (DOMPurify) and a code review note.
- Verify: `rg "dangerously" apps packages`.
- CSP header forbids `script-src` from third parties beyond Mapbox.

## 3. Cross-site request forgery (CSRF)

- Server Actions are protected by Next.js encrypted action IDs.
- Bespoke API routes (`/api/sync`, `/api/uploads/*`, `/api/notifications/*`,
  `/api/push/*`, `/api/ocr/*`, `/api/ai/*`, `/api/webauthn/*`) call
  `assertSameOrigin(req)` from `apps/web/src/lib/csrf.ts`.
- Origins are matched against `NEXT_PUBLIC_*_URL` env vars.

## 4. Open redirects

- All navigation uses `next/link` or `router.push(staticPath)`.
- The only places we touch `window.location.href` should be:
  - Logout (hard reload of `/login`)
  - Mapbox style switcher
- Verify: `rg "window\\.location" apps`.

## 5. Insecure direct object references (IDOR)

- Database RLS already enforces entity isolation. Every table that holds
  Rupafab data has `entity_id` policies wired to the JWT.
- Server actions still re-check the session's `entityId` before any
  mutation that crosses an entity boundary.
- Integration tests in `packages/db/src/__tests__/rls.test.ts` should
  cover cross-entity read+write attempts.

## 6. Authentication

- Magic OTP via Supabase Auth (phone or email).
- Passkeys via WebAuthn (`/api/webauthn/*`).
- Session cookies are HttpOnly + Secure + SameSite=Lax via Supabase SSR.
- Approver PWA requires a passkey before any high-value decision.

## 7. File uploads

- Photo uploads use R2 pre-signed PUT URLs minted server-side from
  `packages/shared/src/r2.ts`.
- MIME allowlist: jpeg, png, webp, heic.
- Size cap: 5 MB before client-side compression to 200 KB at 1600px.
- Receipt photos are stored under `entity-id/year/month/uuid.jpg` and
  never served with a long-lived public URL.

## 8. Rate limiting

- All AI / OCR / transcription endpoints + WebAuthn challenge endpoints
  call `consume({ key, limit, windowMs })` from `@zameen/shared`.
- Bucket storage is `zameen.rate_limit_buckets` so limits survive
  process restarts and PM2 worker fan-out.

## 9. Secrets management

- `.env.example` documents required keys. Real values live in Doppler.
- No secrets in code, commits, or container images.
- Run `gitleaks` (or equivalent) on every pull request.

## 10. Dependency vulnerabilities

- `pnpm audit --audit-level=high` runs in CI on every PR.
- Renovate / Dependabot updates third-party libs weekly.
- Snyk scans the production Docker image post-build.

## 11. HTTP security headers

- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy applied in middleware for all four apps. See
  `apps/*/src/lib/security-headers.ts`.

## 12. Audit logging

- `zameen.audit_log` receives a row for every mutation of money, users,
  fields, recipes, approvals, payroll, automations.
- Helper: `apps/web/src/lib/audit.ts`. Always call after a successful
  write, never before — we never want to log a phantom event.

## 13. Penetration test scope

- External: cross-entity reads, JWT replay, R2 URL tampering,
  WebAuthn challenge reuse.
- Internal: SQL injection sweep, CSP bypass via Mapbox endpoints,
  service worker poisoning on PWAs.
