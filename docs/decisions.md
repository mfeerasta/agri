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

## 2026-05-17: Field PWA sync API surface

Three POST endpoints under `apps/field/src/app/api/`:

- `/api/sync` accepts one `QueuedOp` (resource, operation, payload, idempotencyKey) at a time. A small dispatcher in `apps/field/src/server/sync-dispatcher.ts` maps the `resource` string onto direct drizzle inserts plus the same engines the web app uses: `@zameen/approvals` for routing, `@zameen/finance` for `allocateCost`. The field app deliberately does not import server actions from `@zameen/web` so it stays independently deployable. Approval thresholds, cost-pool selection, and side-effect chains live in the dispatcher and stay in sync with the web actions by construction (shared validators, shared engines).

- Idempotency. Every queued op carries a client-generated `idempotencyKey` (uuid). The route looks the key up in `zameen.idempotency_log` (migration 0008) and short-circuits with the cached response if present. This neutralises retry storms from the offline queue draining after reconnection: even if the network slips between a successful DB insert and a successful HTTP response, the next retry returns the same `{ ok, id }`. The header `x-idempotency-key` is also honoured as a fallback so future non-PWA clients can opt in without restructuring their payload.

- `/api/uploads/r2-presign` runs two modes off the request content type. multipart/form-data triggers a server-mediated upload (the route streams bytes into R2 via PutObject) and returns a single `{ url }` shape, matching the contract `PhotoCapture.uploadFn` already expects. application/json returns a presigned PUT URL so the browser can upload binary content directly to R2; the offline-queue photo drainer uses this path to keep large blobs off the Next.js runtime. Both modes share the same key shape (`prefix/userId/timestamp-filename`) so swapping between them in a deployment does not change the underlying object layout.

- `/api/transcribe` proxies to OpenAI Whisper as Phase 1 STT. Multipart `audio` + optional `lang` ('ur' | 'en'). Whisper covers Urdu adequately for field-notes-grade transcription while we hold for a Phase 3 Nemotron / Urdu-Punjabi fine-tune that can run on-prem. The API key never reaches the browser; the route is the only egress.

Reason. The field PWA was POSTing to three endpoints that did not exist. Building them now with idempotency + dispatcher decoupling means the offline queue can safely retry, and future resource types only need to register a handler in one place.

## 2026-05-17, PostGIS geometry via raw SQL, not a custom Drizzle type

**Decision.** Keep `fields.geometry` and `blocks.geometry` declared as `jsonb()` in the Drizzle schema. The actual database column is converted to `geometry(MultiPolygon, 4326)` by migration `0006_geometry_columns.sql`. All seed-time and server-action writes that touch geometry go through a raw SQL helper, `zameen.geom_from_json(text)`, that wraps `ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)` and `ST_Multi(...)`.

**Why.** Drizzle does not have a first-class PostGIS column type. The two viable alternatives (a `customType` wrapper, or a community PostGIS plugin) each carry pain: `customType` lies to the introspector about the column shape and the generated migrations drift; the plugin path adds a dependency we do not need yet. Application code never reads geometry into JS (only the future Mapbox editor will), and the only writer in Phase 1 is the seed. A typed `geom_from_json` SQL helper is shorter, simpler, and keeps the Drizzle generator honest about what the initial migration creates.

**Alternatives considered.** A Drizzle `customType` emitting `geometry(MultiPolygon, 4326)` directly (forces the initial migration to require PostGIS, complicates seeding); migrating to a community plugin (premature dependency); doing all geometry interaction over RPC only (less ergonomic in the seed).

**Implications.** Reads of geometry from server code must explicitly cast (`ST_AsGeoJSON(geometry)::jsonb as geometry`) when round-tripping through Drizzle. Phase 2 may revisit when the field-polygon editor lands and we need round-trip read/write at scale. Schema docstrings call out the jsonb/PostGIS divergence.

## 2026-05-17, Runtime config injected via psql, not migration

**Decision.** Service role JWT, Supabase project URL, and the CNIC pgcrypto key are written to the database parameter store via `alter database postgres set app.<key> = '<value>'` from a shell script (`supabase/scripts/inject-runtime-config.sh`), not from a migration file.

**Why.** Migrations are checked into git and run identically across environments. Secrets cannot live there. Storing them as database GUCs lets `pg_cron` background workers and pgcrypto wrappers read them with `current_setting('app.<key>', true)` while keeping the secret material out of the repo. The injector is idempotent and rerunning rotates the value.

**Alternatives considered.** Hardcoding in migration (rejected, secret leakage); vault extension (overkill for three values); environment variables on each session (does not work for pg_cron's background sessions).

**Implications.** A new environment needs both `bash supabase/scripts/migrate-all.sh` and the injector to be functional. Documented in `docs/deployment.md` and the migrations README. Rotation is a single-command operation.

## 2026-05-17, Strict migration ordering with idempotent orchestrator

**Decision.** Ten ordered steps (init schema, Drizzle migrate, RLS, storage, cron/triggers, CNIC encryption, geometry columns, RPCs, idempotency log, seed) wrapped by `supabase/scripts/migrate-all.sh`. Every SQL file uses `if not exists`/`create or replace`. The seed runs after `0006_geometry_columns.sql` because field and block geometry inserts now pass through `zameen.geom_from_json`.

**Why.** Hand-written SQL depends on Drizzle-generated tables; PostGIS conversion depends on the seed's input shape; RPCs depend on RLS being live. Without a single canonical order, an operator who reapplies migrations halfway gets a half-broken DB. The orchestrator + idempotency removes the foot-gun.

**Alternatives considered.** Folding everything into Drizzle's own migration runner (Drizzle does not run arbitrary SQL files in order); using Supabase's migration tooling exclusively (we want Drizzle's TS schema as source of truth); Atlas (extra dependency).

**Implications.** New SQL goes through `supabase/migrations/00NN_*.sql` and gets a numbered slot in `migrate-all.sh`. Drizzle owns table/enum DDL only. Documented in `packages/db/migrations/README.md`.


## 2026-05-17: Production hosting on Hetzner CPX31, secrets via Doppler, weekly autopull

**Decision.** Production runs on a single Hetzner CPX31 VPS in Falkenstein (DE), Docker Compose with four Next.js standalone containers behind Caddy, fronted by Cloudflare proxy. Secrets live in Doppler (`zameen` project, `prod` config); the VPS pulls them at boot via a service token, falling back to a hand-edited `/opt/zameen/.env` when Doppler is unreachable. A systemd timer (`zameen-autopull.timer`) does a weekly `git pull && docker compose pull && up -d` on Sunday 03:00 UTC to catch base-image patches with no human in the loop. Daily logical `pg_dump --schema=zameen` ships to Cloudflare R2 bucket `zameen-backups` (30-day retention) via cron at 02:30 UTC, complementing Supabase managed PITR. Cloudflare Tunnel is supported (optional, recommended post-pilot) to remove public 80/443 from the firewall entirely.

**Reason.** Vercel was the obvious default but loses on three axes that matter here. (1) Cost. Four PWAs with photo-heavy traffic on Vercel would run several hundred USD a month at our pilot scale; the CPX31 is roughly twelve EUR a month plus modest R2 egress. (2) Control. Caddy plus Docker Compose lets the operator SSH in, read logs, and restart a container without going through a vendor UI; for a single-tenant farm-ops app run by a finance director that matters. (3) EU data residency. Falkenstein keeps photo metadata and approval audit logs in the EU alongside Supabase EU. Doppler over a hand-managed `.env` because rotating secrets across containers becomes painful otherwise; service tokens make rebuilds trivial. Weekly auto-pull because security patches matter more than zero-downtime in the pilot phase; a five-second blip on Sunday morning is acceptable.

**Alternatives considered.** Vercel for everything (rejected: cost and photo egress). AWS ECS Fargate (rejected: ops complexity for a single-VPS workload). Kubernetes on Hetzner (rejected: massive overkill for four containers). Self-hosted Supabase on the same VPS (rejected: PITR and auth are not worth re-implementing). HashiCorp Vault for secrets (rejected: ops overhead; Doppler is fine for a team of one). Always-on Cloudflare Tunnel (deferred: keeps the pilot ops loop simple, switch on post-pilot).

**Implications.** Disaster recovery is "spin up a fresh CPX31, run `deploy/bootstrap-vps.sh`, repoint the floating IP, `docker compose up -d`"; total downtime budget under thirty minutes. Every script under `deploy/` must remain idempotent because the bootstrap script is the runbook. The VPS holds zero durable state; everything material is in Supabase or R2. Health checks live at `/api/health` on each app and are exercised by `deploy/health-check.sh` (cron-friendly) and by Docker's own `HEALTHCHECK` directive. The full operator-facing runbook is `docs/deployment.md`.

---

## WebAuthn passkey sign-in for the Approver PWA

**Date.** 2026-05-17

**Decision.** Add WebAuthn passkeys as a first-class sign-in path on `approve.agri.feerasta.ai` alongside the existing phone OTP flow. Credentials and challenges live in `zameen.webauthn_credentials` and `zameen.webauthn_challenges`. The relying party ID is the Approver subdomain (`approve.agri.feerasta.ai` in production, `localhost` in dev). Challenges expire after five minutes; a pg_cron job purges expired rows every ten minutes.

**Reason.** MF receives WhatsApp pings, taps the deep link, and needs to land on the decision panel in one tap. Phone OTP is fine for first-time use but slow for the tenth approval of the day. Face ID / Touch ID on iPhone closes that loop instantly, and resident keys mean MF never has to type a phone number. The phone OTP path stays as a fallback for new devices, lost passkeys, and the Farm Manager's Android.

**Session minting bridge.** Supabase v2 does not expose a way for a server to sign and hand back a session pair (`access_token` + `refresh_token`) directly — `signInWithPassword`, `verifyOtp`, and the OAuth flows all require a user-presented credential the server cannot synthesize. The pragmatic path: after the WebAuthn assertion verifies, the verify route calls `supabase.auth.admin.generateLink({ type: 'magiclink', email })` for the resolved user, returns `properties.action_link` to the client, and the client navigates to it. Supabase's verify endpoint then establishes the session cookies. It is a two-hop flow (`POST /api/webauthn/auth/verify` then a navigation), but it stays inside supported Supabase APIs and does not require us to mint or rotate our own JWT signing key.

**Alternatives considered.** Custom JWT signing with the Supabase JWT secret (rejected: brittle, easy to drift from Supabase's own claims schema, no refresh-token story); rolling our own session cookie on top of Supabase auth (rejected: the rest of the app reads `auth.uid()` from Supabase, splitting the session model would break RLS); requiring the user to re-type the OTP after passkey verify (rejected: defeats the purpose).

**Implications.** WebAuthn requires Node crypto, so every route handler under `/api/webauthn` declares `runtime = 'nodejs'`. Service-role Supabase access is used only inside `apps/approve/src/lib/supabase/service.ts` and only by the WebAuthn library — never exposed to the client. RLS on `zameen.webauthn_credentials` restricts users to their own rows; the service-role client bypasses RLS for the pre-session writes. Users without an email cannot use the passkey path because magiclink needs an email; the seed already populates emails for MF and the Farm Manager. The passkey management UI lives at `/passkeys`.


## 2026-05-17, Mapbox-powered field-polygon editor

**Decision.** The field-polygon editor uses Mapbox GL JS with the `satellite-streets-v12` style and `@mapbox/mapbox-gl-draw` as the drawing toolkit. Area is computed client-side and server-side from the GeoJSON with `@turf/area`; the server rejects geometries that fail a Polygon/MultiPolygon shape check and warns (but does not block) when the client-submitted acres value drifts more than 5 percent from the polygon-derived area. Both `mapbox-gl` and `mapbox-gl-draw` are dynamically imported on mount, and the Mapbox CSS is injected via a one-time `<link>` tag rather than bundled.

**Why.** Raiwind fields are five to ten acres each; with OSM tiles the operator cannot tell where one furrow ends and the next begins, so satellite imagery is the only useful basemap at the zoom levels we care about. Leaflet.draw and other alternatives are workable but force a parallel raster stack alongside the existing Mapbox viewer in `field-map.tsx`, and their touch handling on small fields is noticeably worse than `mapbox-gl-draw`'s direct-select mode. Computing area on both sides catches typos: the farm manager keying a number into the acres input is fallible, and a 5 percent tolerance is wide enough to allow rounding while still flagging the case where someone types "62" instead of "6.2". Lazy importing keeps the editor out of pages that only render the read-only `FieldMap`; without it the bundle bloats every dashboard route by roughly 220 KB gzipped.

**Alternatives considered.** Leaflet + leaflet-draw (rejected: doubles the map stack, weaker touch UX). Server-only area derivation (rejected: gives the user no immediate feedback as they draw). Hard-block on >5% area drift (rejected: prevents legitimate manual override for tenure-survey-derived acres). Bundling mapbox-gl-draw's CSS through the package (rejected: would require a new CSS export from `@zameen/ui`; a CDN link is one line and version-pinned).

**Implications.** `NEXT_PUBLIC_MAPBOX_TOKEN` is now required for the field-form to be functional, not just decorative; the form falls back to a clearly labelled placeholder when missing. `apps/web/src/lib/turf.ts` centralises the conversion (square meters times `0.000247105`) for both browser and server. The full-screen map at `/fields/map` is a server component that hydrates a client island with crop-coloured overlays and a legend; clicking a polygon opens an inline side panel with acres, current crop, stage, and last soil pH. Dashboard mini-map cards now render real seeded geometries instead of the diagonal-hatch placeholder.

## In-memory db mock for unit tests, testcontainers reserved for integration

**Decision.** The unit test suite runs with `@zameen/db` and `drizzle-orm` aliased to an in-memory mock at `packages/db/src/__mocks__/`. Two vitest workspaces are wired through `vitest.config.ts`: the default (unit) swaps both modules for the mock and runs on every PR with no Docker; the `RUN_INT_TESTS=1` track keeps the real `@zameen/db` and runs the testcontainers-driven integration suite. The 80% coverage gate on `packages/approvals/src/**` and `packages/finance/src/**` applies only to the unit track. Integration tests run only on pushes to `main` so PR feedback stays fast.

**Why.** Testcontainers boots a Postgres image per test process, which is roughly twenty seconds of overhead per CI shard and an absolute non-starter on contributor laptops without Docker Desktop. The approval and finance engines are pure orchestration over Drizzle's query builder, so a ~400 line shim that resolves predicates against JS arrays gives us coverage of the actual branches (self-approve gating, executor revert, balanced-journal posting, field P&L aggregation, payroll divisor) without the moving parts of a real database. The shim is intentionally narrow: only the subset of the query builder the engines actually use, plus `resetDb()` and `seedDb()` helpers. Drizzle behaviour that does not appear in code under test (constraint enforcement, RLS, real SQL execution) stays the responsibility of the integration suite, which still talks to a real Postgres exactly the way production will.

**Alternatives considered.** Per-file `vi.mock('@zameen/db', ...)` (rejected: every new test had to re-implement a chain shim, and the existing `journal.test.ts` already showed the divergence; centralising kept the shim in one place). Drizzle's `pglite` driver (rejected: still a real engine, still slow on the cold start, and the constraints it enforces would only catch the same surface real Postgres catches in the integration track). Pure unit tests by extracting engine logic from db calls (rejected: the engines are inherently I/O orchestrators and that refactor would buy nothing the mock does not).

**Implications.** Tests import `resetDb`/`seedDb`/`getRows` from `@zameen/db` directly because the alias resolves it to the mock at test time. New executors registered through `registerExecutor` survive across tests in the same file, so call `resetDb()` in `beforeEach` to clear state. The `int` workspace must always be kept able to run against a real database; integration coverage is the regression net for whatever the mock cannot model (joins, sequences, real-time triggers). When adding a new approval type or cost-bearing path, write the unit test against the mock; rely on the integration suite only for cross-table interactions the JS shim cannot fake.

## 2026-05-17, Context snapshots frozen at submission time

**Decision.** Per-module approval context snapshots are computed once at submission time inside `buildFullContext`, persisted into `approvalRequests.contextSnapshot` JSONB, and never recomputed on read. The Approver PWA reads the frozen snapshot. Builders live in `packages/approvals/src/context-builders.ts` and are pure functions over `@zameen/db` only.

**Why.** The approver decides on what was true at request time, not at decision time. If cash balances or aging buckets are recomputed when MF opens the queue, a request that was tight at submission can look comfortable hours later and produce a misleading post-hoc justification. Freezing the snapshot also makes the audit trail self-contained: future readers see exactly the data that informed the call without rerunning queries against drifted state.

**Alternatives considered.** Live recomputation on every page open (rejected: hides cash tightness that motivated the request and loses reproducibility). Snapshot at submission plus a "refresh" button (rejected: invites the same drift, just on demand). Reading from the source modules at decision time via joins (rejected: couples Approver PWA to every module's read model and breaks if data is deleted).

**Implications.** Snapshots are JSON-serialisable (ISO strings, string-encoded decimals, no `Date`, no `bigint`) so they survive JSONB roundtrip without precision loss. Stale data is the trade-off: if an approval sits more than ~24 hours, cash/inventory numbers will drift from reality. Mitigated by the escalation cron, which re-fires WhatsApp notifications and keeps decisions inside a fresh window; the snapshot itself stays unchanged so the audit story stays clean. Adding a new approval-touching server action means calling `buildFullContext({...})` synchronously before `submitApproval`/`withApproval` and passing the result as `contextSnapshot`.

## 2026-05-17, Notification dispatcher wired to Meta WhatsApp + Resend

**Decision.** The approval dispatcher `notifyApprovalEvent` fans an event out to in-app, WhatsApp, and email channels in parallel via `Promise.allSettled`. WhatsApp uses Meta Business Cloud API v20 templates (`zameen_approval_request`, `zameen_approval_decision`, `zameen_escalation_reminder`, `zameen_otp`) rendered via a typed registry in `packages/approvals/src/templates.ts`. Email uses Resend with the same registry's HTML and text bodies.

**Why.** Templates need centralised localisation (en + ur), Meta's positional-only parameter constraint ({{1}}, {{2}}) must be enforced in one place, and channels must fail independently so a WhatsApp template approval gap does not block in-app or email delivery.

**Alternatives considered.** Per-channel template files (duplicate logic, drift between WhatsApp body and email body). Live template fetch from Meta on each send (extra round-trip, rate limit risk). Sequential channel dispatch with early-exit on failure (one channel outage silences the others; rejected).

**Implications.**

- Meta WhatsApp template approval lag is 24-48 hours. Run `supabase/scripts/register-whatsapp-templates.sh` once per WABA and wait for "Approved" before relying on production sends. Newly added templates must be added to the registry, the script, and `templateForEvent` in lockstep.
- All approval deep links converge on the convention `${NEXT_PUBLIC_APPROVE_URL}/<request-id>` (login link for OTP). The Meta URL button uses the same string so the WhatsApp tap experience matches the email CTA.
- The webhook at `supabase/functions/whatsapp-webhook` verifies `x-hub-signature-256` HMAC against `META_WHATSAPP_APP_SECRET` before parsing any payload, then reconciles delivery receipts against `zameen.notifications.payload->>messageId`. Index `idx_notifications_message_id` (migration 0011) keeps that lookup fast.
- The dashboard bell badge polls `/api/notifications/unread` every 30 seconds. We deliberately avoided realtime (Supabase Realtime channel subscription) for now: poll is cheaper for the user counts on AGRI, and the worst-case staleness is 30s. Will revisit if the dispatcher scales beyond ~50 concurrent approver sessions.
- Each channel writes its own `zameen.notifications` row with `channel` set accordingly. The in-app row carries both en and ur bodies; WhatsApp and email rows carry only the locale that was sent and stash the Meta `messageId` (or Resend id) in `payload.messageId` for webhook reconciliation.

## OCR for diesel + repair receipts (2026-05-17)

- Diesel pump receipts and workshop repair slips are extracted using OpenAI GPT-4o vision (`response_format: json_object`) rather than Tesseract or a local OCR model. Pakistani workshop quotes are almost always handwritten in Urdu / Roman Urdu, and the Urdu OCR space has no usable Tesseract trained data: every off-the-shelf model we tested missed digits, vendor names, and quantities. GPT-4o reads mixed Urdu + Latin numerals reliably, including faded thermal-printer tape.
- Auto-fill is gated on the model's self-reported confidence. Below 0.5 we never write to form fields, surface a "receipt unclear, please verify" banner, and persist the raw transcript so the audit log still has evidence. Between 0.5 and 0.8 we prefill empty fields but render every prefilled field with an amber border + tooltip so the operator sees what the model guessed. At or above 0.8 we silently prefill. These thresholds are conservative because every prefilled value flows into an approval threshold check, and the cost of a wrong total is much higher than the cost of asking a human to retype it.
- Offline-captured photos still need OCR after they sync, so we wired a Postgres trigger on `diesel_purchases.receipt_photo_urls` and `repair_quotes.quote_document_urls` that posts to the `ocr-extractor` edge function via `pg_net.invoke_edge_function`. Idempotency is enforced by the `zameen.ocr_extractions` tracking table (unique on `(source_table, source_record_id)`) so re-running the migration or replaying an update never double-extracts. The edge function only fills currently-null columns and stores the raw transcript regardless of confidence.
- Raw extracted text is always stored (`repair_quotes.ocr_extracted_text`, and appended to `diesel_purchases.notes` for diesel) even when confidence is too low to auto-fill. The Approver PWA can render the raw OCR text alongside the photo so a reviewer can cross-check without zooming into a tiny thermal-tape image on their phone.
- Endpoints are rate-limited at 10 requests / user / minute via a process-local token bucket. Phase 1 is single-instance; we will swap to Upstash once the field PWA scales horizontally.
- All OpenAI calls are wrapped in a 30s `AbortController` timeout and degrade gracefully to `{ confidence: 0, rawText: '' }` so a Whisper/Vision outage never breaks a diesel purchase submission.

## 2026-05-17, monday-style task management primitives

**Decision.** Extend `zameen.tasks` with parent_task_id, due_date, priority, label_color, labels[], and attachments columns. Add six new tables: task_dependencies, task_time_entries, entity_comments, entity_activity, entity_labels, saved_views. Centralise comments and activity on two generic tables keyed by `(entity_kind, entity_id)` instead of per-module shadow tables.

**Why.** Tasks, approvals, repairs, crop plans, and feasibility studies all want the same three things: threaded comments with @mentions, a chronological activity stream, and labels. Building one table per module duplicates indexes, RLS, and UI components. The generic-keyed approach lets the Approver PWA, ops dashboard, and field PWA share a single CommentThread + ActivityStream component.

**Alternatives considered.** Per-module comment tables (more typing, simpler joins, no advantage at our scale). A polymorphic join table backed by a single text id (rejected, kills FK integrity). Storing labels inline on every record (already done for tasks via `labels text[]`, but new modules will reuse entity_labels for the colour palette).

**Implications.** Cross-module queries are cheap. RLS on entity_comments uses an `authenticated` role check rather than walking back to the source entity for each row; relying on application-level filtering for the moment. Subitems are limited to one level deep deliberately; nested nesting is a UX trap and the data model can be extended later if needed. Soft mention parsing (`@[Name](uuid)`) is done with a regex inside `@zameen/shared/mentions.ts` rather than importing a markdown library. Saved views are user preferences first; sharing is a boolean flag (no granular RBAC) until ops asks for it. Critical-path computation lives in `@zameen/shared/critical-path.ts` and runs on-demand from the Gantt view; we explicitly do not cache it because dependency graphs at AGRI scale finish in well under 50ms.

## 2026-05-17. Automations + dashboard widgets (monday-style)

**Why.** MF runs Zameen the way a small ops team runs monday.com: rules of the form "when X, do Y" are how field reality gets translated into action. Hardcoding those rules per module (notify-on-approve, escalate-on-overdue, fire-on-anomaly) was scattering trigger logic across five packages. The Approver PWA could surface a single "automations" surface where MF (or his accountant) writes new rules without touching code.

**Decisions.**

1. Recipes stored as JSONB, not a DSL. The trigger taxonomy is a fixed enum (12 kinds), conditions are a typed `{field, op, value}` array (ANDed), actions are `{kind, config}`. No DSL parser, no expression language. This keeps the rule surface auditable from a SQL prompt and means the engine is a switch statement on action kind. If users need OR, they author two recipes; that has been good enough in monday too.

2. Phase 1 wires six trigger emitters and defers six. Live: `task_status_change`, `task_created`, `crop_stage_advance`, `comment_added`, `mention_received`, `approval_submitted/decided`. Cron-driven: `task_due_soon`, `task_overdue`, `inventory_low`, `date_arrives` are queued by the `automation-tick` edge function. Deferred: `diesel_anomaly` (existing detector emits to a flag column; needs a lightweight follow-up dispatcher), and per-action OAuth integrations (Slack OK, Google Calendar stub-only).

3. Template gallery on the new-recipe page. Six pre-baked recipes covering the highest-value ag scenarios (fertiliser-applied notify, maturity auto-harvest task, 2-day overdue escalation, diesel anomaly WhatsApp, mandi >500k director approval, tubewell 30-day recheck). One-tap apply, then user edits in place.

4. Dashboards are widget configs stored as JSONB on `user_dashboards.widgets`. No drag-and-drop library: native HTML drag-drop reorders, +/- buttons resize within a 12-column CSS grid. This trades polish for zero bundle weight; if users complain we can swap in react-grid-layout without changing the data shape.

5. Cross-package decoupling. The approvals engine uses a dynamic `import('@zameen/automations')` inside try/catch so the workspace dependency graph remains a DAG (approvals → ., automations → approvals). If the automations package is absent from a deployment, approvals still functions.

**Implications.** Recipe execution is fire-and-forget from the triggering server action. Errors land in `automation_runs.error_message` and the recipe card surfaces a "partial" badge; the user-facing write never fails because an automation misbehaved. Webhook + Slack handlers go out via fetch; failures count toward `automation_runs.status='partial'`. Adding a new trigger kind = update the SQL enum, add it to TRIGGER_KINDS in `@zameen/automations/types.ts`, wire one `fireTrigger` call at the source site, optionally extend `automation-tick` for date-based variants.

---

## Monday-style multi-view boards (2026-05)

**Context.** Tasks, crop plans, repair requests, and approval requests are all entities operations staff scan, filter, and triage. Rather than a different bespoke list per module, we expose a shared multi-view shell (table, kanban, gantt, calendar, workload, chart) that anyone can switch into. Familiar UX (monday.com / Linear) lowers the training cost for non-technical farm-office users.

**Decisions.**

1. **Server-side critical-path computation.** `computeCriticalPath` from `@zameen/shared` runs inside the labor/tasks server component before data is shipped to the client. The Gantt view consumes a precomputed `critical: boolean` per task. We avoid duplicating the DAG on the client and avoid making the Gantt re-run Kahn's on every filter change. Cost: the page must be `force-dynamic`. Acceptable because Phase 1 has <500 active tasks per entity.

2. **Native HTML5 drag-drop, no react-dnd.** Kanban column moves and calendar cell drops use the browser drag events with a single shared JSON payload helper at `packages/ui/src/lib/drag.ts`. Zero deps. The trade is that touch-screen drag on tablets relies on browser-default behaviour; if field-office iPads complain, swap in `@dnd-kit/core` behind the same `setDragData/getDragData` API without touching pages.

3. **View mode + filters persist via `saved_views`.** Each saved view is a row keyed by `scope` (`tasks`, `crop_plans`, `repairs`, `approvals`) with `viewMode` and a JSONB `config` containing `{ filters, groupBy }`. `shared=true` views are visible to the whole entity. The active view mode itself is local React state, not in the URL, because survey use shows users switch views idly and we want browser back to leave the page, not undo a tab click. Deep-link friendliness is preserved on a single dimension only: the open task drawer is in the URL as `?task=<id>`.

4. **Filter shape is a flat `Record<string, unknown>`.** Each filter key maps directly to a column or computed property. `groupBy` is a separate string. This shape is what gets saved to `saved_views.config.filters`; round-trip is JSON-clean. We avoid a clever query-builder so non-engineers writing seed data can produce a config that just works.

5. **No infinite-scroll on Gantt.** The Gantt component renders the full span as one SVG. For Phase 1 (<200 visible tasks, <90-day windows) this stays under 2 MB of DOM and scrolls fluidly horizontally. If/when we onboard a larger entity, virtualise the rows; the column axis stays full-width because it's the visual point of the view.

6. **Generic `SimpleBoardClient` for non-task entities.** Crop plans, repairs, and approvals share `apps/web/src/app/(dashboard)/crops/board/simple-board-client.tsx`. Tasks get their own richer `TaskBoardClient` because of the drawer, time tracking, and comment integrations. We resisted the temptation to over-generalise: tasks need ~10 server actions wired in, the others need zero.

7. **Boards live at `<module>/board`, not as a query-string tab.** A separate URL means the navigation crumb shows where you are, server components fetch only what the active view needs, and prefetching from the module home is honest. Existing list pages get a small "Board" link in the top-right.

## 2026-05-17. Diesel anomaly persistence, vendor scorecard, CSV bulk import

**Decisions.**

1. Diesel anomalies live in a dedicated `zameen.diesel_anomalies` table, not just `notifications` or `asset_logs`. Notifications are write-once dispatch fan-out (whatsapp, push) and cannot model an acknowledgment lifecycle. Asset logs are an immutable audit stream. We need a row whose status field moves through open → acknowledged → resolved/dismissed and whose resolution notes are first-class. The detector keeps writing to all three: anomalies for workflow, asset_logs for audit, notifications for push.

2. Severity buckets at 15-25%/25-50%/>50% deviation (warning/high/critical). One threshold (15%) under-served the operator who needs to triage by urgency; three buckets let the UI sort and color without storing extra weights.

3. Vendor and workshop scorecards are computed on demand, not cached. Read volume is low (handful of users checking before raising a PO) and freshness matters more than latency. If query time becomes a problem (>16 vendors, hundreds of POs), we'll materialise nightly into `zameen.vendor_scores` rather than reach for in-memory caching that would have to invalidate on every GRN/invoice write.

4. Warranty failure rate is computed from `repair_requests` reported on the same asset within `repair_work_orders.warranty_end`, not from a dedicated warranty-claims table. Repairs already capture the failure event; a separate table would double-book and drift.

5. CSV bulk import is a strict 3-stage flow (upload → map → preview & commit) backed by a single reusable `CsvMapper` component. Single-click "upload and pray" destroys hours of book-keeping when a column header is off-by-one. The mapper forces an explicit column → field mapping and shows the first 5 parsed rows before the user can hit Validate; the commit button is disabled until validation completes.

6. papaparse over csv-parse. csv-parse is node-only; we need the same parser running both client-side (preview, byte counting) and server-side (validation). papaparse is browser-safe, handles quoted JSON inside cells (needed for the `geometry` column on the fields import), and ships under 15 KB gzipped. We accept the looser type definitions in exchange.

7. Templates live as static `apps/web/public/import-templates/{target}.csv` files served by Next's static asset pipeline. No API route, no dynamic generation; users get a 200 OK and a starter row with Urdu strings in the `nameUr` columns so they can see expected formatting in Excel.

8. Field code uniqueness is pre-checked at validation time, not relied upon at insert time. The DB has a unique constraint (`fields.code` per entity), but surfacing the error at the validation preview is gentler than a transaction abort half-way through 50 rows. The commit handler still uses a single `insert().values([...])` call so a constraint violation rolls everything back; pre-validation just prevents the typical case.

## 2026-05-17, PDF and Excel report exports plus audit-log walk page (apps/web)

Owner: Claude Code subagent, MF.

1. @react-pdf/renderer over Puppeteer. Puppeteer pulls headless Chromium (~150 MB) into the Hetzner runtime, plus needs `--no-sandbox`, plus needs font registration. @react-pdf/renderer renders entirely in JS, lets us compose reports as React components alongside the existing UI, supports both Node and Edge runtimes, gives us deterministic layout, and weighs ~5 MB. Trade-off: no CSS Grid / Flexbox-gap quirks, no full HTML feature parity. Acceptable for tabular financial reports.

2. exceljs over xlsx (SheetJS). exceljs supports styled fills, fonts per cell, number formats, frozen panes, merged header rows, and cell borders, which we need for branded output (green header band, ochre accent, money cells with `Rs. #,##0.00`). xlsx CE is a flat parser, no styles. exceljs writes a slightly larger file but well below our 10 MB cap.

3. No "Confidential" watermark on exports. MF was explicit in user-global instructions. Watermark module is therefore not registered. Footer reads "Generated by Zameen" + page X of Y only.

4. Brand palette in exports. Deep green primary (`#1f4d2b`), ochre accent (`#b9802c`) on cream paper. Inter + JetBrains Mono via @react-pdf/font (with Helvetica fallback when offline). The on-screen app is dark; print needs ink-on-paper, so the export palette intentionally diverges from the screen.

5. Audit walk page is read-only. No edit, no comment append, no "re-do this approval" button. Audit views must not produce more audit. Anything that needs a follow-up action lives in the source page (approve PWA detail, finance journal). The walk page renders the trail and links out.

6. JSON-diff over text-diff for `before`/`after` audit columns. Both columns are jsonb. A unified text diff over `JSON.stringify` would highlight irrelevant key-ordering differences. The custom `JsonDiff` widget in `@zameen/ui` walks objects/arrays by key, marks per-leaf changes (added/removed/changed), and colours them green/red/muted. Side-effect: structural-only changes (e.g. array reorder) appear as element changes, which is fine for this domain.

7. Photo evidence rendered as gallery, no thumbnails service. Storage returns direct https URLs already sized at ≤ 200 KB / 1600px long edge (PhotoUploader enforces). The walk page links each photo with `target="_blank"` and uses `<img>` (with the next-image escape lint disable) because we don't need responsive `next/image` srcset for an internal admin tool and we want fewer requests.

8. Exports default to A4 portrait; seasonal review and repair log use landscape because their tables have 8+ columns. Repair log is PDF-only (it's a print-and-file artefact); cost-allocations, journal, and diesel are XLSX-only (analysts pivot them); field-pnl and seasonal are dual.

9. File-size cap is 10 MB hard. Above that we switch to a streaming `ReadableStream` response in chunks of 64 KB. In practice seasonal reports for a 50-field operation come to ~80 KB PDF / ~30 KB XLSX, so this is defensive.

## 2026-05-17, Sentinel-2 NDVI overlay via Sentinel Hub

**Decision.** Wire NDVI overlays onto the field map using Sentinel Hub's Process API (rendered PNG previews) plus Statistical API (numeric mean/min/max/std per acquisition). Storage in `zameen.ndvi_observations`. Daily pull at 01:00 UTC. Free tier is sufficient for one 100-acre farm at the Sentinel-2 5-day revisit cadence.

**Why.**

1. Sentinel-2 over Landsat-8/9. Sentinel-2 has 10 m native resolution and a 5-day revisit; Landsat is 30 m at a 16-day revisit. Many Rupafab fields are 3 to 8 acres, which is 1 to 3 Landsat pixels and 30+ Sentinel pixels. Per-pixel uniformity insight is only useful at the 10 m grid.

2. Statistical API for stored values, Process API only for previews. Statistical API returns mean / min / max / std plus a cloud-cover ratio per polygon per bucket at a fraction of the credit cost of full Process API rasters. We persist the numbers and render the PNG once per acquisition, kept in R2 at roughly 5 KB per field per pass.

3. Cloud-cover threshold of 40%. Below 40% we get usable NDVI; above 40% the Scene Classification mask wipes too many pixels and the mean becomes unrepresentative. Tunable via `CLOUD_COVER_LIMIT` constant in `supabase/functions/ndvi-puller/index.ts`.

4. Cron at 01:00 UTC (06:00 PKT). Sentinel-2 L2A data lands in the Sentinel Hub catalogue with a 6 to 24 hour lag after the satellite pass. 01:00 UTC is comfortably past the daily processing window and well before MF starts the day.

5. Legend gradient red to green, not viridis. NDVI is a domain where the colour mapping is already culturally cemented for farmers: red is stressed, green is healthy. A perceptually uniform viridis ramp would technically be better for scientific accuracy but worse for the actual user.

6. R2 preview storage over Supabase Storage. Already wired R2 for photo evidence (`@zameen/shared/r2`); reusing the same SigV4 signer in the edge function keeps the operational surface narrow. PNGs are ~5 KB each at 512x512, so 100 fields x 5 day revisit x 365 days ~= 36 MB/year. Negligible.

**Alternatives considered.**

- Self-hosted Sentinel-2 via Copernicus Open Access Hub + GDAL. Free at the source but operationally heavy (raster storage, mosaicking, atmospheric correction). Sentinel Hub already does this and the free tier is enough.
- Planet Labs daily imagery at 3 m resolution. Better cadence and resolution, but commercial pricing per km^2 makes it untenable for a single-farm pilot. Revisit during expansion.
- Storing previews as data URLs in jsonb. Quick to ship but bloats the table; R2 with a CDN-fronted public base is cleaner.

**Implications.** Sentinel Hub credentials must be present in production env. Free-tier credit usage is ~30 PU per field per pass with the Statistical API, plus ~5 PU per preview render; well within the 30 000 PU/month free allowance. Add `SENTINEL_HUB_CLIENT_ID` and `SENTINEL_HUB_CLIENT_SECRET` to the secrets bundle on deploy. Backfill via `supabase/scripts/backfill-ndvi.sh` for new tenants. The NDVI anomaly banner on the field detail page fires when the latest observation drops >0.2 below the 6-observation rolling mean; tune the threshold in `apps/web/src/app/(dashboard)/fields/[id]/page.tsx` if false positives appear during canopy senescence.


---

## 2026-05-17. Inbound WhatsApp NLU and AI feasibility drafts

**Decision.** Inbound WhatsApp messages from workers and supervisors are parsed by Anthropic Claude into a fixed intent set (task_completion, diesel_log, diesel_purchase, repair_report, harvest_log, milk_log, attendance_check_in, attendance_check_out, comment) inside the existing supabase edge function `whatsapp-webhook`. Confidence below 0.5 or explicit ambiguity triggers a bilingual clarification round-trip rather than a guess. The same Claude wrapper drafts feasibility studies from a short prompt, which then becomes a starter the Director edits before submitting for approval.

**Why Claude over GPT-4.** Workers write in Urdu, Roman Urdu, and mixed scripts. Claude's tokenizer compresses non-Latin scripts more efficiently than GPT-4's BPE on Roman-only corpora, lowering both latency and per-message cost. Anecdotally Claude also follows the JSON-only output instruction more reliably without the function-calling overhead. We fall through to `{ intent: 'unknown' }` on every error path so the webhook stays correct when the upstream is down.

**Confidence threshold of 0.5 plus a clarification round-trip.** A worker who writes "F3 ki kahani" should be asked back, not silently dispatched. Setting the threshold any lower invites bad inserts; setting it higher rejects half of valid Roman Urdu. The clarification message names exactly the field that is missing in Urdu first, English second, with a 1-line example.

**processIntent registry pattern.** Mirror of `apps/field/src/server/sync-dispatcher.ts`. One function per intent, all writing through the service-role Supabase client into `zameen.*` rather than importing the Node-only drizzle + approvals packages into the Deno runtime. Threshold checks for diesel purchases are inlined here from `DEFAULT_APPROVAL_THRESHOLDS_PKR`; if they ever drift, both files need to update. A unit test on a future Phase 2 sync would catch this.

**Feasibility AI draft as starter not final.** The draft never auto-submits. It writes into the New Feasibility form, the Director edits any section, then explicitly hits "Save and submit for Director approval". The architectural rule (approval-first, even for the Director) is preserved. We keep `feasibility_study` as a Director-only approval type with thresholds of 0 for everyone else so an AI-drafted document cannot bypass MF.

**Bilingual replies keyed to the worker's preferred locale.** `zameen.users.preferred_locale` is `ur` by default. The reply builder in `replies.ts` emits Urdu first, English second when the locale is `ur` or unset, and English-only when explicitly `en`. Templates are short so they remain inside the WhatsApp 1024-char comprehensible window.

**Attendance via WhatsApp accepted but flagged GPS-null.** WhatsApp text messages do not carry GPS. Rather than reject the intent, we accept the check-in with `check_in_gps = null` and `within_geofence = null`. Trade-off: workers without a smartphone PWA can mark presence remotely, defeating the geofence anti-fraud control. Mitigation: a future Phase 2 supervisor dashboard surfaces "remote attendance" rows for spot-check. The audit trail still shows the source as `whatsapp`. Documented here so we do not lose the trade-off when adding stricter HR rules.

**Signature verification preserved.** Every POST is HMAC-verified before any DB write. Inbound message handling cannot run on a forged payload.

**Implications.**

- `ANTHROPIC_API_KEY` becomes a required secret in production. Without it, `parseMessage` falls back to `unknown` and inbound flow degrades gracefully to clarification replies.
- `ANTHROPIC_MODEL` is an optional override (defaults to `claude-3-5-sonnet-20241022`). Easy to bump to a newer model when one lands.
- The webhook now writes to many tables (`task_completions`, `diesel_daily_logs`, `diesel_purchases`, `repair_requests`, `harvest_records`, `milk_records`, `attendance_records`, `entity_comments`, `approval_requests`). RLS policies must allow the service-role client to insert into all of these, which is already the case.

## 2026-05-17. Narrative AI assistants surfaced across the platform

**Decision.** Anthropic Claude (`claude-3-5-sonnet-20241022` by default, override via `ZAMEEN_CLAUDE_MODEL`) is the narrative-AI engine across four touch points: a per-page help drawer, a global voice search, a crop-plan advisor card, and an approval explainer panel. OpenAI Whisper handles speech-to-text; OpenAI `text-embedding-3-small` is reserved for the Phase 2 vector index. The wrapper lives in `packages/shared/src/anthropic.ts` with `complete` and `stream` shapes plus a shared `HOUSE_STYLE` block that bans em-dashes.

**Why Claude for narrative.** Mirrors the existing inbound-WhatsApp NLU decision. Claude's tone in mixed Urdu and English copy reads more naturally than GPT-4o for the kind of soft prose that goes into a "why this matters" or a crop recommendation. Anthropic's prompt caching also lets us hold a stable house-style block at near-zero marginal cost as the surfaces multiply.

**Why OpenAI for embeddings.** `text-embedding-3-small` is cheaper per million tokens than Voyage or Cohere and good enough for short entity-record text. We are not embedding documents in Phase 1; the search endpoint does server-side ilike for now, with the vector index slated for Phase 2 alongside the Mapbox field editor.

**Cache 24 hours per (kind, key) in `zameen.ai_advisor_cache`.** The crop advisor and approval explainer responses change slowly relative to the underlying data, so MF should not see a different summary every refresh. A 24-hour TTL bounds spend, gives stable output for screenshots, and is short enough that a fresh weather record or a context update propagates within a day. The cache is purged by a pg_cron job (`purge-ai-advisor-cache`).

**AI never blocks workflow.** Every AI endpoint times out at 60s and returns a graceful empty payload. The crop advisor card hides itself on zero confidence. The approval explainer renders nothing if Claude is unreachable. MF can always approve, log, or post without AI being available.

**`ai_call_log` for cost and abuse tracking.** Every call writes a row (kind, user_id, entity_id, prompt summary, token counts, latency, model, cached, error). PII is scrubbed before logging via `summarizePrompt`. The table is RLS-protected (service role write, owner read). A nightly pg_cron job trims rows past 180 days.

**Rate limits in-memory at 30 calls per user per hour.** Sufficient for a single-instance Phase 1 deploy. Reuses the existing token-bucket helper at `apps/web/src/lib/rate-limit.ts`. Swap for Upstash when the Approver PWA goes multi-region.

**No on-device LLM yet.** A future Phase 4 might run a small distilled model on the supervisor's phone for offline crop advice, but Phase 1 to 3 keep all inference server-side. This keeps the Field PWA install size lean and battery use predictable.

**Implications.**

- `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are both required for full functionality. Missing keys degrade endpoints to empty responses; users see "AI unavailable" hints rather than errors.
- A new shared style rule: every AI-returned string passes through prompts that ban em-dashes. The house-style block lives in `@zameen/shared/anthropic.ts`.
- The advisor card on a crop plan deep-links to the task creation form with prefilled fields. If we ever rename `/crops/tasks/new`, update `ai-advisor-card.tsx`.
- The help drawer is mounted globally inside the dashboard layout. Each page registers a context string via `useRegisterPageContext('...')`. Pages that do not register fall back to a generic system prompt.

## Dashboard responsiveness and per-user locale (May 2026)

### Breakpoints

- `sm` (640px+) — phones in landscape, very small tablets. Sidebar hidden; top hamburger reveals slide-in menu. Stat grids go 1 → 2 col.
- `md` (768px+) — iPad mini and Galaxy Tab portrait. Sidebar collapses to a 56px icon-only rail; hover expands to a 240px overlay with labels for 200ms. Stat grids stay 2 col; main content padding `px-6 py-6`.
- `lg` (1024px+) — full desktop. Sidebar pinned at 240px with labels. Stat grids 4 col. Main content `px-8 py-8`.

### Sidebar collapse strategy

The sidebar is one `<aside>` element. CSS-only width transitions between 56px and 240px on `md`; pinned at 240px on `lg`. Mobile breakpoint hides it and renders a slide-in panel inside a fixed-position overlay with a dimmed backdrop. State lives in `responsive-nav.tsx`; the server layout passes pre-rendered nav items (with localized labels and JSX icons) as props so the heavy nav remains server-rendered.

### Locale resolution chain

`getLocale()` in `apps/web/src/lib/locale.ts` resolves in this order: `users.preferredLocale` (DB) → `zameenLocale` cookie → web default `en`. The field PWA continues to default to `ur` per `DEFAULT_LOCALE`. The web dashboard's default is the new `WEB_DEFAULT_LOCALE = 'en'` export. The locale switcher writes both the cookie (immediate) and the DB row (server action, persistent across devices), plus mirrors to `localStorage.zameenLocale` for client-side hints.

### Eastern Arabic numerals are opt-in

`fmtNumber()` now accepts `locale` and `useEasternNumerals` parameters. Finance staff (MF in particular) types figures in English numerals and reads them faster that way, so the Urdu locale alone does not flip numerals. A future `users.preferences.useEasternNumerals` flag will gate it per user. Dates always follow the locale (because the visual difference is smaller and date readability in Urdu is genuinely better for non-English readers).

### Table overflow strategy

Tables wrap in `overflow-x-auto` with `min-w-full` so all columns are preserved on small screens. We chose horizontal scroll over hiding columns because the value M needs is often the rightmost column (decided amount, decided-at). Truncating loses the audit trail.

### Touch targets

Button `cva` sizes now include `min-h-[44px]` on mobile (`min-h-[40px]` on `md+`). Table rows use `py-3` on mobile and `py-2` on `md+` for the same reason. Buttons fall back to 44px which matches Apple HIG and Android M3 recommendations for tablet glove-tap usability while walking.

### RTL handling

When `locale === 'ur'` the dashboard layout sets `<html dir="rtl">` and reverses the flex order so the sidebar appears on the right. Tables stay LTR for tabular numbers; only the headers' alignment flips via `dir` inheritance.

## 2026-05-17, Web Push notifications

### Web Push over native push

Picked the W3C Web Push standard (VAPID + `web-push` library) over Firebase Cloud Messaging, OneSignal, or native iOS/Android apps. Same surface area as the existing PWAs — no app-store review, no separate codebase. iOS 16.4+ on Safari ships Web Push for installed PWAs (the user must Add to Home Screen first), which matches how MF uses the Approver app. No vendor lock-in or per-MAU pricing; we own the keypair and talk straight to the user-agent push endpoints (Apple/Google/Mozilla). Cross-platform automatically — desktop Chrome, Android Chrome, iOS PWA all share one path. We own subscription lifecycle (404/410 pruning), encapsulated in `packages/shared/src/push.ts`.

### Per-app push subscriptions

`push_subscriptions` rows carry an `app` column (`web` | `field` | `ops` | `approve`). MF's iPhone is paired with the Approver PWA, so his approval pings go to the `approve` subscription set. Workers using the Field PWA get attendance and task pings to the `field` set. Same person may install multiple PWAs; decision pings should land only on the device used to decide. `sendPushToUser(userId, app, payload)` filters at fan-out time; `app === 'any'` is the fallback when the typed surface has no subscription.

### VAPID keypair, never logged

Private key is read once per process from `ZAMEEN_VAPID_PRIVATE_KEY` and passed to `webpush.setVapidDetails`. Never appears in log output, never sent to the client, never leaves the server runtime. Public key is exposed via `NEXT_PUBLIC_ZAMEEN_VAPID_PUBLIC_KEY` so the EnablePush widget converts it to a Uint8Array for the PushManager. Rotation invalidates every existing subscription, so we only rotate on compromise. Generated via `supabase/scripts/generate-vapid-keys.sh`.

### Opt-in per-event channels, stored as JSONB

`users.notification_prefs` is a JSONB column keyed by event name (`approvalSubmitted`, `approvalDecided`, `mention`, `anomalyDetected`, `escalationReminder`), each pointing at an array of channels (`in_app`, `whatsapp`, `push`, `email`). JSONB beats a separate table because the event taxonomy will keep growing, prefs are always fetched alongside the user row, and defaults ship in the migration's `default ... ::jsonb`. Zod validator on the server action enforces shape; `notify.ts` intersects caller-passed channels with the user's allowed channels per event.

### No server-side badge counter

We do not maintain `notifications.unreadCount` on the server. Each client computes its own badge locally from unread `notifications` rows it can see. iOS doesn't expose `navigator.setAppBadge` to PWAs reliably; when it does, the badge becomes a derived client number. Server counters would require a write on every read, creating contention. The bell already polls `/api/notifications/unread-count`.

### Notification grouping via `tag`

All approval events share `tag = 'zameen-approvals'`. iOS coalesces notifications with the same tag, so a flurry of escalation reminders for the same request does not stack — the latest replaces the earlier. The deep link inside `data.deepLink` still points at the specific approval. OTP pushes use a separate tag (`zameen-otp`) so they never get swallowed.

### `requireInteraction` is high-priority only

Notifications with `priority: 'high'` (new approval requests, escalation reminders, OTP) set `requireInteraction: true` so they stick in the tray until dismissed. Decision events (approved/rejected) and routine info use `priority: 'normal'` and auto-dismiss. Keeps "act now" distinct from "FYI" without a second channel.

### Failure handling: 404/410 prune, 3-strike otherwise

Push endpoints become permanently invalid when the user uninstalls the PWA or revokes permission — those return HTTP 404 or 410 and we delete the row immediately. Transient failures (5xx, network) increment `failure_count`; after three consecutive failures we delete the row. Matches the `web-push` recommended pattern and avoids zombie subscriptions.

## 2026-05-17 Production hardening pass

### CSP with explicit allowlists, not broad rules

CSP per app uses named hosts (Supabase, Mapbox, Sentinel Hub, Anthropic, OpenAI) rather than a wildcard. `script-src` remains `'self' 'unsafe-inline'` because Next.js streams server components inline; we accept that risk because XSS is already foreclosed by React escaping and we have no third-party script tags. Per-app variants live in `apps/*/src/lib/security-headers.ts`. Field + Approve PWAs additionally allow `worker-src 'self' blob:` for the service worker; Web + Ops do not.

### CSRF via Origin header check

All Zameen clients are same-origin SPAs. Bespoke API routes (sync, uploads, notifications, push, ocr, ai, webauthn) gate on a matching `Origin` or `Referer` against the configured `NEXT_PUBLIC_*_URL` envs via `apps/web/src/lib/csrf.ts`. Server Actions get framework-level encrypted IDs and need nothing extra. Rationale: same-site cookies + Origin check is the cheapest robust defence for this topology; tokens-in-headers add no value when we control all callers.

### Rate-limit moved to DB for multi-process Hetzner deploy

In-memory token buckets evaporated across PM2 worker restarts. The new `consume()` in `@zameen/shared/rate-limit` uses `zameen.rate_limit_buckets` with `INSERT ... ON CONFLICT DO UPDATE`. Falls back to memory when `DATABASE_URL` is unset for tests. Migration `0023_rate_limits.sql` creates the table and a purge function.

### audit_log as the always-on tape

`entity_activity` stays module-specific (task comments, document mentions). `zameen.audit_log` is the canonical tape for sensitive mutations: money, approvals, users, fields, recipes, payroll, automations, settings. Helper at `apps/web/src/lib/audit.ts` captures actor, IP, user-agent, before / after diff. Lossy on failure by design — never break the write because audit logging hiccuped.

### Lighthouse budget targets

Allow Mapbox + Recharts in the main bundle because both are needed on the first dashboard paint. We accept a 500KB per-chunk JS budget enforced by `deploy/check-bundle-size.sh`. Lighthouse thresholds: perf 80, a11y 90, BP 90, SEO 80; FCP 2s, LCP 3s, TBT 300ms, CLS 0.1.

### No on-device captcha for Phase 1

Pilot users are a closed cohort of Rupafab employees. Captcha adds friction with no real bot pressure. Revisit once the platform opens to outside contractors.

## 2026-05-17, Year-on-year and multi-season tracking

**Decision.** Add YoY comparison and field-trend dashboards under `/reports/year-over-year`, `/reports/field-trends`, and `/reports/field-matrix`. Aggregation helpers live in `packages/finance/src/yoy.ts`.

**Aggregation strategy.** Server-side SQL aggregation per season (one grouped query per dimension: cost by plan, yield by plan, revenue by plan), not N+1 calls to `computeFieldPnL`. This keeps a full YoY render under one round-trip per metric and scales linearly with crop plans rather than quadratically.

**Season label as string column.** `crop_plans.season_label` stays a free-text `varchar(32)` (e.g. "Rabi 2025-26"). Seasons are open-ended and overlap calendar years, so a separate `seasons` table or foreign key would force us to assign dates we don't always have. Sort order in YoY pages comes from `max(created_at)` per season, not from parsing the label.

**Trend direction = OLS slope on margin/acre.** `computeFieldRollingTrend` derives `improving` / `declining` / `flat` from a simple least-squares slope across the last N seasons of margin/acre. The flat band is `|slope| <= max(1, |meanY| * 0.02)`. Robust enough for 3-7 data points without pulling in a stats library.

**5-year rolling default.** Matches CLAUDE.md spec and Rupafab's planning horizon. Clamped to `[2, 10]` years; the matrix view truncates from the most-recent end.

**Benchmarks come from `crop_profiles.yieldBenchmarkPerAcre`.** Single source of truth that already drives seasonal-review variance. YoY pages compute `yieldVsBenchmarkPct` against the same value to avoid two different yardsticks across reports.

**No incremental cache.** Seasons close once a year. Pages are `force-dynamic` and recompute on each load. Caching adds complexity for a workload that already runs in well under a second on the pilot's data volume; revisit once we have 100+ fields or 10+ seasons of history.

## 2026-05-17, Crop disease photo classifier (Phase 2)

**Claude vision over Plant.id API.** Claude 3.5 Sonnet vision gives us multilingual reasoning, custom system-prompt grounding on Punjab pests and diseases, and bilingual treatment text in one shot. Plant.id has solid identification but no IPM guidance, no Urdu output, and uneven coverage of common Punjab crops (rust strains, citrus greening, CLCuV). Cost per image is comparable. Deferring a fine-tuned vision model to Phase 3 once we accumulate confirmed-diagnosis labels.

**Confidence 0.5 default, always-show review actions.** We never auto-treat. Every diagnostic starts in `pending_review` and surfaces confirm / dismiss / treated / resolved actions. Below 0.5 we show "Unclear" and route to supervisor review. Auto-treating would risk wasted sprays and worker safety.

**Bilingual treatment text (en + ur) in one row.** Field workers read the Urdu version; supervisors and MF read the English. Storing both columns avoids translation drift and a separate i18n pipeline. The Claude prompt enforces a plain Urdu translation, no Roman Urdu mixing.

**Severity workflow.** `pending_review -> confirmed | dismissed -> treated -> resolved`. Dismissed is terminal. Treated keeps the record open for a follow-up check; resolved closes it. Status is a free text column (not an enum) to avoid migration friction during Phase 2 iteration.

**Static reference library to ground Claude.** `packages/shared/src/lib/punjab-crop-diseases.json` ships ~30 named entries covering wheat rusts and smut, maize stem borer and fall armyworm, cotton bollworm, whitefly, CLCuV, rice blast and BPH, sugarcane top borer and red rot, citrus canker and greening, and the common N/P/K/Zn/B deficiencies. The list is fed into the system prompt filtered by crop. This reduces hallucinated labels without locking the model to a fixed taxonomy.

**Backfill via dedicated edge function.** `supabase/functions/diagnostics-backfill/index.ts` walks `crop_stage_logs.photo_urls` and inserts a diagnostic per photo, skipping already-diagnosed URLs. The web `/api/diagnostics/backfill` does a smaller in-process 100-photo run for interactive use. Running larger backfills inside Next.js would tie up serverless connections during the slow Claude calls.

**Diagnostics scoped through field RLS.** The `diag_via_field` policy walks `fields -> blocks -> farms` to check `accessible_entity_ids(auth.uid())`. No separate diagnostics-level grants. Matches every other field-scoped table in the schema.
