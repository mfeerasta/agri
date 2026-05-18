# Security audit - May 2026

Date: 2026-05-18
Scope: Defensive hardening of Zameen platform ahead of Rupafab pilot launch
with real PKR financial data. No links or cross-references to Sentinel or
Haazri products.

## What was checked

- `apps/web/src/middleware.ts` + per-app middlewares (field, ops, approve)
- `apps/web/src/lib/security-headers.ts` + sibling files in field/ops/approve
- `apps/web/src/lib/csrf.ts`, `validate-body.ts`, `audit.ts`
- `packages/shared/src/rate-limit.ts`
- `supabase/migrations/0002_rls_policies.sql` plus full migration set up
  through `0042_csp_violations.sql`
- Route handlers in each app under `apps/*/src/app/api/`
- Upload paths: `apps/web/src/app/api/uploads/receipts/route.ts`,
  `apps/field/src/app/api/uploads/r2-presign/route.ts`

## What was added

1. **Secret scanner** at `deploy/scan-secrets.sh` plus pre-commit hook
   (`deploy/pre-commit-hook.sh`) and installer (`deploy/install-hooks.sh`).
   CI workflow `.github/workflows/secret-scan.yml` runs the same script on
   every push and PR. Allow-listed paths: `.env.example`, `docs/`, `*.md`.
2. **Log redaction** at `packages/shared/src/redact.ts`. Recursive key-name
   match against 15 sensitive keys plus token-shaped string heuristic.
   `safeStringify(...)` wraps every JSON serialization for logs.
3. **Custom ESLint rule** `tools/eslint-rules/no-raw-console-log.cjs`
   wired into `eslint.config.js` as `zameen/no-raw-console-log: warn`.
4. **Dependency audit** workflow `.github/workflows/dependency-audit.yml`
   runs `pnpm audit` weekly and files a GitHub issue with findings.
5. **RLS isolation fuzz** at `e2e/specs/16-rls-isolation-fuzz.spec.ts`.
   Exercises 28 tables; any cross-entity leak fails the run.
6. **File upload magic-number validation** at
   `apps/web/src/lib/file-validation.ts` and
   `apps/field/src/lib/file-validation.ts`. Reads the first 16 bytes and
   matches against jpeg/png/webp/heic/gif/pdf signatures. Wired into the
   receipts and R2 presign multipart routes.
7. **PublicError pattern** in `packages/shared/src/errors.ts`. Route
   handlers now log the raw error via `safeStringify` and respond with
   `toUserMessage(e)`, so DB messages never leak to clients.
8. **CSP report-only** mode across all four apps. Header switched from
   enforcing to `Content-Security-Policy-Report-Only` with
   `report-uri /api/csp-report`. New endpoint in each app writes into
   `zameen.csp_violations` (migration `0042_csp_violations.sql`, schema
   `packages/db/src/schema/csp-violations.ts`).

## What's deferred

- Third-party penetration test scheduled for Phase 2 once we exit the
  Rupafab pilot.
- Native CNIC field-level encryption with KMS (currently column-level
  AES via `0005_cnic_encryption.sql`; KMS rotation is post-pilot).
- WAF rules at the Caddy layer (`deploy/Caddyfile`); pending the
  WhatsApp dispatcher migration.

## How to re-run the audit

```bash
# 1. Secret scan
bash deploy/scan-secrets.sh

# 2. Dependency audit
pnpm audit --audit-level=high

# 3. RLS fuzz (requires local supabase)
pnpm exec playwright test e2e/specs/16-rls-isolation-fuzz.spec.ts

# 4. CSP review (after one week of report-only traffic)
psql $DATABASE_URL -c \
  "select app, violated_directive, blocked_uri, count(*) \
   from zameen.csp_violations \
   where occurred_at > now() - interval '7 days' \
   group by 1, 2, 3 order by 4 desc;"
```

Once item 4 is clean for a full week, flip the header name in the four
`security-headers.ts` files from `Content-Security-Policy-Report-Only`
back to `Content-Security-Policy` and redeploy.
