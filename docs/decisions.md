# Decision log

Running log of platform decisions for Zameen. Append-only. Each entry: date, decision, why, alternatives considered, implications. Long-form rationale for the most consequential items lives in `docs/adr/`.

## 2026-04-02, Shared Supabase project, schema isolation

**Decision.** Zameen tables live in the `zameen` schema of the existing Haazri Supabase project `qcvxefbrzkspoldjydrx`. Haazri retains `public.*`. Cross-schema joins via explicit grant only.

**Why.** One billable Supabase project, one auth user pool (workers may be present in both products), shared connection pool. No second-project sprawl.

**Alternatives considered.** Standalone Supabase project (clean isolation, double billing, separate auth); self-hosted Postgres on the Hetzner VPS (operational burden, no managed Auth or Storage).

**Implications.** Cross-team migration coordination required. RLS policies must explicitly deny `zameen.*` to `public` consumers and vice versa. Noisy-neighbour risk on shared quotas. ADR 0001.

## 2026-04-02, PKR-only money

**Decision.** No multi-currency support anywhere in the platform. DB columns are `decimal(.., 2)` PKR. Application layer uses bigint paisa via `@zameen/shared/money`.

**Why.** AGRI and all Phase 1 to Phase 3 target tenants operate exclusively in PKR. Foreign-currency notes (USD reference prices, EUR remittance memos) belong in free-text fields, not in the money layer. Avoids an FX engine the platform does not need.

**Alternatives considered.** Multi-currency from day one with PKR as the entity's base currency (overkill, leaks FX complexity into every form); decimal-only with no bigint (float drift risk in JS).

**Implications.** Any future tenant operating in a non-PKR primary loses the ability to onboard. Acceptable. ADR 0002.

## 2026-04-05, Approver PWA is the canonical approval channel

**Decision.** Approve, reject, send-back, and escalate actions only happen in the Approver PWA at `approve.agri.feerasta.ai`. WhatsApp is notification-only and replies are stripped of any inline-decision intent.

**Why.** WhatsApp inline "reply YES to approve" patterns lose context (no cash position, no quote comparison, no audit-grade GPS) and are spoofable. The Approver PWA captures GPS, IP, user agent, and the full context snapshot at decision time.

**Alternatives considered.** WhatsApp inline approve with a stored token (lower friction, lower audit fidelity, MF rejected); email-link approvals (slow, no GPS); voice-call approvals (no audit trail).

**Implications.** Higher friction at the moment of decision. MF must open the PWA. Mitigated by deep-link push from WhatsApp. ADR 0003.

## 2026-04-06, Hold-then-execute approval pattern

**Decision.** Every cost-bearing or asset-touching mutation submits an approval first, then executes only after `approved`. There is no "submit and approve in one click" path for non-director actors. Director approvals on their own requests still write to `approval_actions` for audit.

**Why.** Unifies the audit path. Every state change has a `(fromState, toState, actor, timestamp)` tuple. No silent commits, ever.

**Alternatives considered.** Optimistic execute with rollback on rejection (cleaner UX, harder audit, harder to reverse inventory deductions); approval as advisory note alongside direct execution (no point).

**Implications.** Workers cannot self-issue diesel without supervisor approval; this is a feature, not a bug. The state machine in `packages/approvals/src/state-machine.ts` is the spine. ADR 0004.

## 2026-04-08, pnpm + Turbo + Next.js 15 + Drizzle + shadcn stack lock

**Decision.** Monorepo with pnpm workspaces and Turbo. Four Next.js 15 apps (App Router, Server Actions). Drizzle ORM. shadcn/ui primitives over Radix. Tailwind v4. TypeScript strict.

**Why.** pnpm avoids npm hoist drama; Turbo gives cached builds across four apps. Next.js 15 App Router gives Server Actions, which keep the mutation surface server-side without an explicit API layer. Drizzle gives a type-safe schema authoring path with raw SQL fallback. shadcn over a heavier component library because we own the source.

**Alternatives considered.** Prisma (heavier runtime, less SQL ergonomic, see ADR 0006); Nx instead of Turbo (more powerful, more config, not needed at four apps); MUI or Mantine (less customizable, larger bundle).

**Implications.** Stack is locked for Phase 1 and Phase 2. Any change requires an ADR. ADR 0006 covers Drizzle specifically.

## 2026-04-10, Cloudflare R2 for high-volume photos

**Decision.** Geotagged field photos (diesel receipts, repair damage, crop stage, harvest, livestock) go to Cloudflare R2 via presigned PUT. Supabase Storage is used only for entity documents, feasibility study attachments, worker CNIC scans.

**Why.** R2 has zero egress fees. Phase 1 projects 30 to 60 photos per active day at AGRI; Phase 2 with multi-tenant goes to 500+ per day. Supabase Storage egress is meaningful at that volume.

**Alternatives considered.** Supabase Storage end-to-end (one less vendor, real egress cost); self-hosted MinIO on the Hetzner VPS (operational burden, no Cloudflare edge).

**Implications.** Two storage paths in the codebase. Presigned URL flow is documented in `docs/api.md`. ADR 0005.

## 2026-04-12, Hetzner VPS with Docker and Caddy for production

**Decision.** Production hosts on Hetzner CPX31 (4 vCPU, 8 GB RAM) in Falkenstein DE. Docker Compose orchestrates the four Next.js apps, each as a standalone build. Caddy fronts with automatic TLS via Cloudflare DNS challenge.

**Why.** Predictable monthly cost (€16). Full control over the runtime. Avoids Vercel egress costs and edge-cold-start variance on a PWA workload that benefits from a warm origin. Cloudflare proxy in front provides DDoS mitigation and CDN.

**Alternatives considered.** Vercel (faster DX, higher cost, edge runtime constraints on our `next/og` and Workbox usage); Fly.io (good per-region story, more expensive); AWS Fargate (heavy operational surface).

**Implications.** We own uptime monitoring. Deploy is a single SSH push and `docker compose up -d`. Backup of Supabase is managed by Supabase; backup of R2 is via lifecycle rules.

## 2026-04-12, Output `standalone` for each Next.js app

**Decision.** Each app uses `output: 'standalone'` in `next.config.js`. Build produces a self-contained `.next/standalone/` tree with a minimal node_modules.

**Why.** Docker images stay under 250 MB compressed. No `pnpm install` in production containers. Faster cold start.

**Alternatives considered.** Standard Next.js output with full node_modules baked (larger images, slower deploys); Bun runtime (immature ecosystem for Next.js 15 server actions).

**Implications.** Server-only modules must be explicit imports; dynamic `require` paths break the standalone bundler. Tested via the `pnpm build` step in CI.

## 2026-04-15, ESLint flat config, Vitest, Playwright

**Decision.** ESLint v9 flat config across the monorepo. Vitest for unit and integration tests in every package. Playwright for end-to-end across the four apps.

**Why.** Flat config lets each package extend a shared base without `.eslintrc` cascading drama. Vitest matches Vite's ergonomics and is significantly faster than Jest on this codebase. Playwright handles the PWA install and offline flow tests that Cypress struggles with.

**Alternatives considered.** Jest + Cypress (slower test runs, harder offline simulation); Bun test (immature for our Drizzle test fixtures).

**Implications.** Test command is `pnpm test` (Vitest) and `pnpm e2e` (Playwright). CI runs both on every PR.

## 2026-04-18, `pg_cron` + `pg_net` + LISTEN/NOTIFY, no Redis

**Decision.** Background jobs and outbound HTTP calls live inside Postgres via `pg_cron` for schedules and `pg_net` for outbound. Realtime app-to-app pub/sub uses LISTEN/NOTIFY. No Redis.

**Why.** One fewer service to operate. Supabase ships both extensions. The work load (six scheduled jobs, single-digit notifications per minute) is well inside Postgres capacity. Redis would add a dependency for sub-1ms latency that we do not need.

**Alternatives considered.** Redis with BullMQ (overkill, separate ops surface); Cloudflare Queues (newer, less mature, additional vendor); a separate Node worker process polling Postgres (we end up reimplementing pg_cron).

**Implications.** Queue depth visibility is via Postgres queries, not Redis tooling. Acceptable. If we hit Postgres connection pool pressure at Phase 2, we revisit.

## 2026-04-20, PostGIS for field geometry

**Decision.** Field polygons stored as `geometry(Polygon, 4326)` via PostGIS, not as GeoJSON in `jsonb`.

**Why.** Enables spatial queries (area calculation, point-in-field for GPS-tagged photos, adjacency for irrigation planning). PostGIS area calculations are accurate; ad-hoc GeoJSON-in-jsonb is not.

**Alternatives considered.** GeoJSON in `jsonb` (no spatial queries, hand-rolled area math); a separate spatial service (overkill).

**Implications.** Supabase enables PostGIS by extension; migrations include `create extension postgis`. Drizzle has a community PostGIS helper; we use raw SQL for the few spatial queries we run. ADR 0007.

## 2026-04-22, PWA over native mobile apps

**Decision.** Field and Approver clients are PWAs, not React Native or native Android apps.

**Why.** Single codebase, instant updates (no Play Store review for the worker path), full offline capability via Workbox, full camera and GPS access on Android Chrome. Workers install via Add to Home Screen.

**Alternatives considered.** React Native (separate build, store submissions, no real win for our workload); Capacitor wrapper (extra layer, marginal benefit); a native Android app for the Field PWA only (one team, no native skill).

**Implications.** iOS install path is rougher (Safari only, no install prompt API). Acceptable; iOS share at AGRI is one phone (MF). ADR 0008.

## 2026-05-17, Hold-then-execute via executor registry

**Decision.** Server actions wrap mutations in `withApproval(...)`. Modules `registerExecutor(type, fn)` at import. On `decide()` transitioning to `approved`, the engine calls the registered executor inside the same flow; if it throws, state reverts to `in_review` with an audit comment.

**Why.** Keeps the "no side effects without approval" invariant truly enforced at the type level, and centralizes self-approve auditing. The registry pattern means new modules wire side effects in one place without touching the engine.

**Alternatives considered.** Cron sweep over `state=approved` (latency, plus risk of double-execution); explicit "execute" call from server actions after polling (boilerplate everywhere, easy to forget).

**Implications.** Executors must be idempotent and registered at module import (top-level), not inside server actions. Failed executors keep the audit row but leave state at `in_review` so a human can intervene.

## 2026-05-17, Notification fan-out, WhatsApp stays read-only

**Decision.** `notifyApprovalEvent` writes an in-app `zameen.notifications` row, sends a WhatsApp template, and sends a Resend email per event. Each channel's failure is caught and logged into the notifications table with `failedReason`; channels do not block each other.

**Why.** WhatsApp can't show the full cash position / quote comparison, so it stays a deep-link beacon. Email is a desktop backup. In-app is the authoritative inbox. Per-channel failure isolation prevents one provider outage from breaking notifications wholesale.

## 2026-05-17, Cash-floor warnings live in entity_settings.units_config

**Decision.** Cash-floor threshold for `computeCashFlowForecast` is read from `entity_settings.units_config.cashFloorPkr` rather than a new column.

**Why.** Schema is locked. `units_config` is already a free-form jsonb where per-entity overrides live, so reusing it avoids a migration while keeping the floor configurable per entity.

## 2026-05-17, Payroll divisor lookup by entity code

**Decision.** `payrollDivisorFor(entityId)` keys off `entities.code` (AGRI flat-30, RFB actual-calendar, ZP flat-26) rather than a dedicated column.

**Why.** Matches Haazri parity model already shipped on the worker side. No schema change, and the entity code is the canonical identifier across both schemas.

## 2026-05-17, Phase 2 backend infrastructure

**Decision.** Implement cron, edge functions, geometry, encryption, RPCs.

- Cron schedules anchored to PKT but stored as UTC strings (no DST). pg_net used for async edge-function dispatch.
- LISTEN/NOTIFY channel `approval_events`; payload kept to ids/scalars.
- Audit log immutability enforced at trigger layer in addition to denied-by-default RLS.
- `field_pnl_cache` table preferred over materialized view (row-level upsert beats full MV refresh).
- CNIC decryption gated to director / farm_manager / super_admin via SECURITY DEFINER wrapper.
- Geometry migration runs after Drizzle migrate; idempotent guard checks the column data type.
- R2 presigned URL uses SigV4 with region `auto` and the bucket in the canonical URI path.
- Cross-schema Haazri view falls back to `WHERE false` when `public.workers` is absent.
- Runtime secrets (`app.service_role_jwt`, `app.supabase_url`, `app.cnic_key`) injected via `alter database`, never in migration text.
- Edge functions pinned to `@supabase/supabase-js@2.46.1` via esm.sh.

**Alternatives.** Materialized view for P&L (rejected, slow refresh). pgRest only via REST (rejected, RPC needed for compound writes). pg_net via `http_post_async` only (chosen).

**Implications.** Operators must run `alter database` once per environment after creating the database; otherwise cron schedules silently skip with a NOTICE.

## 2026-05-17, Testing + CI/CD wiring

**Decision.** Vitest at the root (workspace-aware include globs), ESLint 9 flat config at the root, Playwright with three named projects (web 3000, field 3001, approve 3003), testcontainers Postgres for integration, four GitHub Actions workflows.

**Why.**
- Unit and integration tests share a vitest config so coverage rolls up cleanly; integration tests are gated behind `RUN_INT_TESTS=1` to keep `pnpm test` Docker-free.
- ESLint flat config enforces project conventions inline: em-dash literals (both Literal and TemplateElement) blocked via `no-restricted-syntax`; cross-app `@/components/*` imports blocked via `no-restricted-imports`; tailwind class ordering via the official plugin.
- Coverage threshold (80) is scoped to `packages/approvals/src/**` and `packages/finance/src/**` only; UI and apps are deliberately not gated.
- Per-app Playwright projects pin each app to its own baseURL and let `E2E_*_URL` env vars redirect to staging without rewriting tests.
- Prod deploy is `workflow_dispatch` and never rebuilds; it re-tags `staging-<sha>` to `prod-<sha>` and `prod-latest` via `docker buildx imagetools create`, then SSHes and runs `deploy/deploy.sh` if present.

**Alternatives considered.** Jest (slower, ESM friction); per-package vitest configs (duplication, harder coverage rollup); rebuilding images on prod deploy (drift risk between staging-tested artifact and prod artifact, rejected).

**Implications.** Contributors need Docker only to run `pnpm test:int` or `pnpm test:e2e` against a local stack. CI sticks a "Migration plan" comment on any PR touching `supabase/migrations/**` or `packages/db/migrations/**`. Prod deploys require an explicit human-pasted SHA, never auto-promote from main.


## 2026-05-17: Design system, "Sowing Almanac"

Locked in an editorial agricultural-archive aesthetic. Display: Fraunces (variable, opsz + SOFT + WONK). Body: Inter Tight. Numerical data: JetBrains Mono with tabular-nums. Urdu: Noto Nastaliq Urdu. Palette: ink, paper, paper-2, zameen 300/500/700, ochre, clay, rust. Hairline rules instead of borders; section dividers carry `+` glyphs at intersections. Currency always shows "Rs." prefix in Fraunces small-caps + ochre, numeric body in JetBrains Mono. Mastheads on every page render "ZAMEEN · Rupafab Agri · SECTION · Raiwind Farm · Hijri · Gregorian" in mono uppercase. Reason: MF is a finance director, this UI will see daily use over years, and trust comes from typography and numerical density, not animation or gloss. Alternatives rejected: shadcn slate-grey default, purple gradients, glass-morphism, lottie. Implications: every figure must use the `<Pkr>` component; every page composes Masthead + SectionDivider + StatBlocks; new widgets must follow the hairline-rules-not-borders rule.

## 2026-05-17: Naming, "Rupafab Agri" (entity), "Raiwind Farm" (farm)

Zameen is built for Rupafab Limited's agriculture operation. The first and current farm is at Raiwind, Lahore (~100 acres). Entity record: code AGRI, name "Rupafab Agri", legal name "Rupafab Limited (Agriculture Operation)". Farm record: code AGRI-RWD, name "Raiwind Farm". Dashboards and reports default to this pairing but always show an entity + farm selector so additional farms can be onboarded later without renaming. Approvals route to MF as Director, Rupafab Agri.

## 2026-05-17 (later): Design system pivot to flex.one-inspired dark UI

Reason: MF requested flex.one's aesthetic. Replaced "Sowing Almanac" warm-paper editorial with a dark-first, premium fintech look. Palette: `#0A0A0B` background, `#15151A`/`#1C1C22` surfaces, `#F4F4F5` foreground, electric cyan `#5BE3FF` as the sole accent (used for hover, focus, links, key data points). Subtle radial gradient washes in the body background. Cards use 14px radius, 1px white-at-8% borders, soft shadows. Buttons 10px radius, fg-on-bg primary that flips to accent on hover. Typography swapped Fraunces + Inter Tight for Geist + Geist Mono (system geometric sans, premium, free via Google Fonts). Urdu retained Noto Nastaliq Urdu. StatBlocks now stacked vertical with delta pills (success-green or danger-red). Charts use single cyan stroke on dotted grid. Approval banners use coloured tint backgrounds keyed to state. Dashboard hero rebuilt with stat grid on top, two-up "today" section, field-activity card grid, hairline footer. All four apps inherit via the shared Tailwind preset.
