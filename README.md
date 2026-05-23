# Zameen

[![ci](https://github.com/feerasta/zameen/actions/workflows/ci.yml/badge.svg)](https://github.com/feerasta/zameen/actions/workflows/ci.yml)
[![mobile-field-ios](https://github.com/feerasta/zameen/actions/workflows/mobile-field-ios.yml/badge.svg)](https://github.com/feerasta/zameen/actions/workflows/mobile-field-ios.yml)
[![mobile-field-android](https://github.com/feerasta/zameen/actions/workflows/mobile-field-android.yml/badge.svg)](https://github.com/feerasta/zameen/actions/workflows/mobile-field-android.yml)
[![mobile-ops-ios](https://github.com/feerasta/zameen/actions/workflows/mobile-ops-ios.yml/badge.svg)](https://github.com/feerasta/zameen/actions/workflows/mobile-ops-ios.yml)
[![mobile-ops-android](https://github.com/feerasta/zameen/actions/workflows/mobile-ops-android.yml/badge.svg)](https://github.com/feerasta/zameen/actions/workflows/mobile-ops-android.yml)

Unified farm operations platform for medium-to-large mixed crop and livestock farms in Pakistan. Pilot at Rupafab Agri (Raiwind Farm) (~100 acres, wheat/maize, Sahiwal dairy, goats).

Primary domain: `agri.feerasta.ai`. Subdomains: `field.agri.feerasta.ai`, `ops.agri.feerasta.ai`, `approve.agri.feerasta.ai`, `api.agri.feerasta.ai`. VPS: Hetzner CPX31, Cloudflare proxy. DB: shared Supabase project `qcvxefbrzkspoldjydrx` (Zameen tables in `zameen` schema, Haazri stays in `public`).

## Repo layout

```
apps/
  web/        # Management dashboard (Next.js 15, port 3000)
  field/      # Worker PWA, Urdu-first, offline (port 3001)
  ops/        # Supervisor ops view (port 3002)
  approve/    # Approver PWA — canonical channel for approve/reject (port 3003)

packages/
  db/         # Drizzle schema (zameen.* tables), migrations, seed
  shared/     # Zod validators, PKR money, units, constants
  approvals/  # State machine + threshold routing + delegation
  finance/    # Cost allocation, journal posting, per-field P&L
  locale/     # ur / roman_ur / en bundles
  ui/         # shadcn primitives + BigButton, PhotoUploader, VoiceInput

supabase/
  config.toml
  migrations/   # SQL: schema, RLS, storage buckets
  functions/    # Edge functions (Phase 2+)
```

## Local dev

```bash
pnpm install
supabase start
pnpm db:migrate          # applies Drizzle migrations
pnpm db:seed             # AGRI entity, crops, COA, approval workflows
pnpm dev                 # turbo runs all four Next apps
pnpm dev --filter=@zameen/web
```

## Architectural pillars

1. **Approval-first**. Every material money/inventory/asset action runs through `@zameen/approvals`. No silent commits, ever. Director approvals on their own requests are auto-recorded but logged.
2. **PKR-only money**. Internally bigint paisa, DB columns `decimal(.., 2)`, display via `formatPkr`. No FX engine.
3. **Per-field P&L**. Every cost allocation tags `field_id` + `crop_plan_id` + `cost_pool`. `computeFieldPnL(cropPlanId)` is the killer report.
4. **Diesel and Repair are dedicated modules**, not features. Receipt photos mandatory. Closing-stock variance flagged. Three-quote workflow for repairs above threshold.
5. **Mobile-first with offline queue**. Field PWA stores ops in IndexedDB (`@/lib/offline-queue`) and drains on `online`.
6. **Urdu primary**. `lang="ur" dir="rtl"` on the field PWA. Translations in `@zameen/locale`.

## Phase 1 scope (in this commit)

- Auth (Supabase phone OTP)
- Land + crop plans
- Inventory (input + produce + asset)
- **Diesel module (full)** — purchases, daily logs, reconciliation, allocation
- **Repair module (full)** — request, multi-quote, approval, work order, parts history
- Labor + attendance
- Cash book with per-field cost capture
- Approval workflow engine with all defined thresholds
- Multi-entity setup with `zameen` schema isolation

Phases 2 and 3 (livestock detail, satellite NDVI, voice STT, pest ID) are scaffolded but not implemented.

## Files of note

- `packages/db/src/schema/diesel.ts` — top loss-leader, treated first-class.
- `packages/db/src/schema/repairs.ts` — quotes table is the comparison source.
- `packages/approvals/src/state-machine.ts` — bounded transitions, throws on illegal.
- `packages/approvals/src/routing.ts` — escalate, never block.
- `packages/finance/src/cost-allocation.ts` — `proportionalSplit` for cross-field allocations.
- `apps/approve/src/app/[id]/decision-panel.tsx` — captures GPS, IP, comment per decision.

## Convention reminders

- File names: kebab-case, no underscores.
- No em-dashes in docs, comments, commit messages.
- No "Confidential" watermark in generated documents.
- All UI strings used by the field PWA must have an Urdu translation in the same PR.

## Deployment

See `deploy/README.md` for Hetzner + Cloudflare + Caddy setup.

## How to add a new approval-requiring action

Three steps. No exceptions.

1. **Declare.** Add the approval type to `approval_type` enum in `packages/db/src/schema/enums.ts` and to `APPROVAL_TYPES` in `packages/shared/src/constants.ts`. Add a default threshold row to `DEFAULT_APPROVAL_THRESHOLDS_PKR`. Add a seed row to `approval_workflows` if the entity needs non-default policy.
2. **Submit.** In the server action that creates the underlying record, call `submitApproval({ entityId, approvalType, sourceModule, sourceRecordId, title, amountPkr, payload, contextSnapshot, requestedBy, actorRole })` from `@zameen/approvals`. The `contextSnapshot` is what the Approver PWA renders; include cash position, recent similar transactions, and any photos.
3. **Bind.** Add `approval_request_id` foreign key on the underlying record table. Render `<ApprovalBanner requestId={...} />` from `@zameen/ui` on the read side. Side effects (inventory deduction, journal posting, cost allocation) fire only on the `execute` transition, never on submit.

For cost-bearing actions, also call `allocateCost(...)` from `@zameen/finance` and `postJournal(...)` with matching `sourceRecordId` so the audit walk reaches both sides.

## Testing strategy

Three tiers.

- **Unit (Vitest).** Pure functions in `packages/shared`, `packages/approvals`, `packages/finance`. Money arithmetic, state-machine transitions, threshold routing, proportional split, journal balance. Run with `pnpm test`. Target: under 5 seconds full suite.
- **Integration (Vitest + Supabase test container).** Database-touching code. Drizzle queries against a throwaway Postgres with the full schema and seed loaded. RLS policy tests. RPC tests. Run with `pnpm test:integration`.
- **End-to-end (Playwright).** Four apps, real Chromium. Tests cover: worker submits a diesel purchase offline, drains queue, supervisor approves on the Approver PWA, director sees the audit trail. Urdu locale snapshot tests. PWA install flow. Run with `pnpm e2e`.

CI runs all three on every PR. Migrations apply against the integration container before the integration suite.

## Onboarding checklist for a new developer

1. Install Node 20, pnpm 9, Docker, Supabase CLI.
2. Clone, `pnpm install`, `supabase start`, `pnpm db:migrate`, `pnpm db:seed`.
3. Read `CLAUDE.md`, `docs/prd.md`, `docs/data-model.md`, `docs/approval-flows.md` in that order.
4. Skim the eight ADRs in `docs/adr/`.
5. Run `pnpm dev` and tap through each of the four apps at `localhost:3000-3003`. Log in with the seeded MF account.
6. Open `packages/approvals/src/state-machine.ts` and `packages/finance/src/cost-allocation.ts`. These two files are the platform's spine.
7. First task: add a small Urdu translation in `packages/locale/src/ur.ts` for a missing key and watch CI catch it if you skip the `en` and `roman_ur` mirrors.
8. Read `docs/mobile-pwa.md` before touching the Field PWA. Read `docs/localization.md` before touching any user-facing string.
9. Approval-touching work: ADR 0003 and ADR 0004 are mandatory reading.
10. Money-touching work: ADR 0002 and the `@zameen/shared/money` module are mandatory reading. No floats on money paths, ever.
