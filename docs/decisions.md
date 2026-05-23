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

## Mobile shell: Capacitor over React Native (Phase 3)

**Capacitor wraps the existing field PWA, no rewrite.** Adoption of the field
PWA is held back by the absence of a Play Store / App Store presence, not by
the PWA experience itself. Rewriting the worker UI in React Native would
duplicate every screen, every form, every offline-queue handler, and force us
to maintain two stacks. Capacitor keeps the Next.js PWA as the single source
of truth and adds a native shell that loads `field.agri.feerasta.ai` in a
WKWebView (iOS) or WebView (Android). One codebase, two extra shells.

**Server-URL mode over fully-bundled web assets.** Capacitor supports two
delivery modes: (1) bundle the built static web into the app and ship via
the stores, (2) point `server.url` at the live web origin and load it at
runtime. We chose (2). Updates to the field PWA ship instantly without an
app-store review cycle. The store binary only needs a new build when native
plugins, permissions, app icon, or signing changes. Trade-off accepted: the
app needs network at first launch to load the PWA shell; the PWA's service
worker handles every subsequent boot.

**FCM HTTP v1 for both iOS and Android.** Apple Push Notification service
(APNS) and Firebase Cloud Messaging (FCM) both work for iOS, but FCM offers
a single API for both platforms. Apple lets you upload an APNS auth key into
Firebase and FCM bridges payloads through. One server-side path
(`packages/shared/src/fcm.ts`), one set of credentials, one
`@capacitor/push-notifications` plugin call on the client. Web push keeps
its existing VAPID/web-push pipeline; the router in `sendPushToUser`
dispatches by `platform`.

**One `push_subscriptions` row per device, regardless of stack.** Migration
`0028_push_native_tokens.sql` adds `platform` and `native_token` columns and
relaxes `endpoint`/`p256dh`/`auth` to nullable, with a check constraint
enforcing "web rows carry the web-push triple, native rows carry a
native_token". This keeps the audit trail of "which subscribers got
notified" in one table.

**Tablet shell shares the same approach.** `apps/mobile-ops/` mirrors
`apps/mobile-field/` with a different appId (`ai.feerasta.zameen.ops`)
pointed at the ops origin. iPad + Galaxy Tab supervisors get a tablet-shaped
native shell on top of the same web app they already use.

**iOS signing stays manual through Phase 3.** GitHub Actions builds Android
APKs on every `v*-mobile` tag via `mobile-build.yml`. iOS signed builds are
produced manually in Xcode on a macOS workstation against the Apple
Developer cert. Fastlane Match + a self-hosted macOS runner are deferred to
the post-Phase-3 hardening pass — automating signing introduces a different
class of risk (cert leaks, provisioning-profile drift) that we'd rather not
take on while the native shell is brand new.

**Bridge injected, PWA unchanged.** The PWA source code does not import any
`@capacitor/*` package. Instead, the native shell ships a tiny TS bundle
(`apps/mobile-field/src/bridge/inject.ts`) that installs
`window.__zameenNative__` on `DOMContentLoaded`. The PWA already
feature-detects `window.__zameenNative__` to prefer native camera + GPS +
durable-offline + push when available. This keeps the web bundle free of
native deps and lets the bridge evolve independently.

## 2026-05-17. Offline sync UX, cron health dashboard, DR drill automation

### Exponential backoff schedule for the field PWA queue

Workers on prepaid 3G/4G see intermittent failures. Retrying every drain
tick (60s) is wasteful on both battery and data, and a single broken
record can monopolise the channel. The queue now records `attempts`,
`lastError`, `nextRetryAt` per op and follows a 5s / 30s / 5min / 30min /
4h backoff before giving up. Failed ops stay in IDB so the worker can see
what didn't sync and the field manager can decide whether to retry or
drop. The "give up after 5 attempts" rule keeps the queue bounded so a
poison record can't pin the device.

### Background Sync API for online wake-up

Service workers register a `sync` event with tag `zameen-drain-queue`
after each enqueue. When the device comes back online the browser fires
the event and the SW POSTs `/api/sync/drain-trigger` to wake the tab.
The actual drain still runs client-side because IndexedDB isn't reachable
from the SW context in our pattern. iOS Safari doesn't ship Background
Sync; the existing 60s `SyncDaemon` interval is the fallback.

### pg_cron via trigger sync into application table

`cron.job_run_details` lives in the `cron` schema and isn't RLS-aware. To
expose pg_cron history alongside edge-function runs in a single
`/admin/jobs` dashboard we mirror inserts into `zameen.job_runs` via an
after-insert trigger. Edge functions write to the same table through a
`trackJobRun` helper. Net effect: one dashboard, one RLS policy
(`auth.role() = authenticated` for read, service role for write), and ops
can filter by job_name / kind / status without leaving the app.

### Monthly DR drill in CI on GitHub-hosted Postgres

A real Hetzner CX11 spin-up costs about $0.005 / hour and adds Slack
noise from cloud-init. For the monthly automated drill the failure modes
we care about are: the dump being truncated, the schema drifting against
the running migrations, FK violations, and unbalanced journals. All of
these are catchable in a vanilla `postgres:16-alpine` service container
on GitHub Actions, which costs nothing and finishes in under 5 minutes.
On-demand drills against a Hetzner box are still possible via
`deploy/dr-drill.sh` with `DR_TARGET=hetzner` and remain the right call
before any large migration cutover.

### Backup manifest with row counts catches truncated dumps

`deploy/backup.sh` writes a sibling `*.manifest.json` with size, sha256,
generated-at, and per-table row counts. The DR drill verifies that
`entities`, `users`, and `fields` row counts are > 0 in the manifest
before even attempting a restore. This catches the "pg_dump exited 0 but
the dump is empty" failure mode that motivated the drill in the first
place.


## 2026-05-17 - Daily ops digest, weekly summaries, multi-farm onboarding

Five locked decisions for the digest and onboarding feature set.

Slack Block Kit over plain text. The daily ops digest goes to MF's Slack
workspace. Plain text would have been simpler, but Block Kit gives sectioned
KPI fields, divider rhythm, and inline buttons that link directly to a
pending approval in the Approver PWA. MF can act from inside Slack without
context-switching to the dashboard. The webhook URL is treated as a secret
and masked in the admin table view.

Three channels for digests: Slack, email, WhatsApp. Each one shows up where
MF already is. Slack is the primary daily channel (his ops chat). Email is
the weekly format because the email renderer can ship inline SVG charts
and a cost-breakdown table without depending on a remote image host.
WhatsApp is the fallback for situations where MF is on his phone with no
data connection to render rich content - the message is plain text, capped
at 1024 chars, with a short link to the approver queue.

15-minute cron tick. The digest-sender Edge Function runs every 15 minutes
and walks zameen.digest_subscriptions. Each row has a send_time_local in
its own timezone; the function only fires the row when local minutes have
passed and last_sent_at is from a prior calendar day. This is coarser than
a per-minute tick but well within the resolution MF needs for a daily
digest, and it cuts pg_cron load substantially.

Onboarding draft state persisted. The five-step wizard takes 20-45 minutes
to fill (entity setup, land + blocks + fields, people, crops, automations).
That is too long for a single browser session, especially when MF is
running between rooms in Lahore. zameen.onboarding_drafts stores the full
WizardState as jsonb, scoped by created_by with RLS. Every autosave goes
through the saveDraftState server action, and the page resumes from the
most recent un-finalized draft on next visit.

Atomic finalize via Drizzle transactions. createEntityFromWizard and
createFarmFromWizard each wrap their inserts in db.transaction(). If any
step fails, the partial work rolls back and the wizard surfaces the error
in its commit log so MF can fix the input and retry. People + crop plans
+ digests are written sequentially (separate transactions) because each
depends on the previous step's returned ID; the log captures progress
between transactions.

No "tenant per farm" rebrand. The schema already supports multiple farms
under one entity (farms.entity_id). When the next Rupafab farm comes
online it will be a new zameen.farms row under the same Rupafab entity,
not a new tenant. The wizard's step 1 lets MF pick "existing entity" for
exactly this case. A future "Rupafab Agri 2" subsidiary entity would be
created via the same wizard with mode='new'.

---

## Phase 1 launch: training, tours, auditor, analytics

### Worker training mode via boolean column, not separate schema

Every transactional table that field workers can write to now carries
`is_training boolean not null default false`. A `training_sessions` row
opens when the worker toggles training mode in the field PWA and closes
on toggle-off. A weekly cron (supabase/scripts/cleanup-training-data.sh)
purges every is_training = true row, scoped by query, not by tenant.

Considered: a parallel zameen_training schema with the same tables.
Rejected because every read-side query (anomaly detection, dashboards,
P&L) would have needed conditional UNION logic, and writes would have
needed to choose schemas at runtime. The boolean approach keeps query
paths simple and lets the cleanup script stay mechanical: seven DELETE
statements, no joins, no schema introspection. Partial indexes on the
training flag keep the cleanup script under a second even at scale.

The field PWA banner is intentionally loud: yellow background, emoji,
Urdu + English, sticky at the top of every page. There is no way to
miss it. Forms read the `isTrainingMode()` helper at submit time and
set is_training in the resulting row.

### Per-role product tours, one-time, skippable, resumable

Tours are defined per role in apps/web/src/lib/tours/index.ts. The
dashboard layout auto-starts the role's tour on first load by reading
users.tours_completed / tours_skipped. Skipping records to tours_skipped
so the tour does not re-appear; resetting from /admin/profile clears
both arrays. localStorage is used as a fast client-side cache to avoid
flashing the tour for users who just dismissed it.

Considered: a third-party library like Shepherd or Intro.js. Rejected
because the tour is small (eight steps max), needs to live inside the
zameen tokens (--accent, --paper), and must not pull a 30 KB dependency.
The ProductTour component in @zameen/ui is 4 KB and uses
data-tour="..." anchors that any page can opt into.

### Auditor role: parallel SELECT-only RLS policies

Auditor is now a value in zameen.user_role. Migration 0033 grants
auditors SELECT on every table in the zameen schema and never grants
INSERT/UPDATE/DELETE. The app-layer UI also hides admin nav and shows
a read-only banner, but the database is the source of truth. Even if
an attacker bypasses the React shell, Postgres refuses writes.

The audit workspace at /audit/period composes a side-by-side view of
journal entries, journal lines, approval chain, and cost allocations
for a selected period. Export endpoints (XLSX, PDF) are stubbed for
the auditor's offline review. We avoid building auditor-specific
queries: the existing tables, joined the same way the accountant view
joins them, are what the auditor sees.

### Self-hosted platform analytics, not third-party

zameen.platform_events stores every page view, approval decision, AI
call, export download, and training-mode toggle. Director and
super_admin can read; any authenticated session can insert. Data
residency requirement for Phase 1: no PII leaves Pakistan-hosted
Supabase. PostHog or Amplitude can be added later as an additional
sink if MF wants funnel analysis on top of the raw events, but the
events table remains the authoritative log.

Tracking is fire-and-forget: a 1-second AbortSignal.timeout on the
fetch ensures analytics never delays a page render or a server action.
Errors are swallowed; missing env vars are a no-op. Props are
restricted to small primitives (path, event type, decision id) so
no PII leaks beyond the user_id reference that platform_events
already stores.

The middleware tracks page_view for every authenticated request that
is not /api or /admin/analytics (to avoid recursion when MF views the
analytics dashboard). The trackEvent helper in @zameen/shared is
called from server actions for non-page events (approvals, AI calls,
exports).

## 2026-05-17 — Punjabi/Hindi locales, ICS export, full-text receipts archive

### Punjabi in Shahmukhi, not Gurmukhi
Pakistani Punjab uses the Perso-Arabic Shahmukhi script. East Punjab Gurmukhi
is out of scope for this farm — workers in Raiwind read Urdu naskh natively
and Shahmukhi sits adjacent to it. Adding Gurmukhi would force a second font
stack and confuse readers. The 'pa' locale is RTL like 'ur', shares the urdu
body class, and falls back to 'ur' then 'en' if a key is missing.

### Hindi added for completeness, but field PWA default stays Urdu
Hindi (hi, Devanagari, LTR) is included because some seasonal workers from
Indian Punjab transit through. UI default remains Urdu. Hindi fallback chain
goes straight to English — no Urdu fallback because the scripts diverge.

### ICS hand-rolled, no library
The buildIcs helper in @zameen/shared is ~150 lines, RFC 5545 compliant, with
proper CRLF line endings, text escaping, line folding, and a hard-coded
Asia/Karachi VTIMEZONE (no DST so no rule needed). Calendar payloads stay
under 50 KB even for a year of tasks — not worth pulling ical-generator.

### Calendar subscribe tokens scope-limited
A token granted for 'tasks' can never read approvals or feasibility studies.
Scope 'all' exists for power users who want one URL for everything but is
explicit at creation time. Tokens are random 24-byte base64url strings, not
JWTs — no signing key to manage, simple revocation via DELETE on the row.
Expiry is optional; last_accessed_at tracks usage. RLS scopes to the owning
user only.

### FTS via 'simple' dictionary
Postgres core ships English, German, French, etc. dictionaries but no Urdu,
Punjabi, or Hindi stemmer. Rather than self-hosting a custom dictionary, we
use the 'simple' dictionary which lowercases and strips punctuation without
stemming. For receipts, OCR text in the documents.metadata->>'ocrText' field
provides searchable surface for Urdu receipts photographed in the field — the
OCR pipeline runs through Anthropic vision which produces transliterated +
romanized text alongside the original.

### Unified receipts archive, not per-module search
MF's mental model is "find the receipt from three months ago" — not "find the
diesel purchase". The /receipts page does a UNION ALL across documents,
diesel_purchases, input_purchases, and repair_quotes, ranked by date. Each
result links back to its source record for follow-up. The search is
intentionally fuzzy: prefix wildcards on every token, OR semantics within the
query, broad date/amount/vendor filters. Trade-off: cross-module queries are
slower than per-table queries (50ms vs 10ms typical), but the lookup pattern
is once-a-month not once-a-minute.

## Spray planner and weather-alert auto-tasks (2026-05)

### Scoring function intentionally simple
The spray-window recommender is a sum of weighted penalties: wind, rain,
temperature, humidity, and PHI-vs-harvest. No ML, no remote model call. Two
reasons. First, the user audience is a worker who needs to understand why a
window won and an alternative did not — every penalty writes into rationale or
warnings so the UI can show the reasoning verbatim. Second, the inputs come
from a free weather API with known noise floor, so an ML model would be
optimizing past sensor jitter. If a window ranks badly we can blame a
specific rule, not a black box.

### Five-window cap
planSprayWindows returns the top 5 across the 7-day horizon. Showing all 14
slots (morning and evening for each day) created decision fatigue in the
field test: workers picked the first one that looked acceptable rather than
weighing alternatives. Five is enough for "today morning vs tomorrow morning
vs day-after evening" without scrolling.

### Pre-baked rule templates over a freeform DSL
The weather-rules admin page exposes five hand-written templates (frost,
heatwave, heavy rain, strong wind, drought) rather than a generic
condition-action builder. Same reasoning as the spray planner: farmer-side
adoption needs a one-click install path. Customization is allowed but
restricted to threshold numbers, not condition restructuring. Power-users
can write rules directly in the DB.

### weather-alert-checker scheduled after weather-puller
weather-puller runs every 3 hours; we lock the alert evaluation cron at 04:30
UTC, half an hour after the 04:00 puller tick. Running the two as a single
job would tie alert latency to weather-fetch failures: we want the checker
to use the freshest available data but to not block on it.

### Pakistan-specific pesticide registry
packages/shared/src/lib/punjab-pesticides.json hand-curates roughly 30
products with their PHI in days. A generic Western registry would skew
toward chemistries that are not legal or not common here (e.g. neonicotinoid
restrictions, organochlorine bans), and would miss locally heavy users like
Profenofos and Diafenthiuron. PHI values come from EPA, Codex, and PAB
labels; we keep it static rather than pulling a live database to avoid a
hard dependency for an obscure data source.

## Worker leaderboard and bonus scheme

### Composite score with explicit, auditable weights
The score is the sum of seven independent contributions: attendance (30),
tasks completed (25), piece-rate volume (25), piece-rate earnings (15),
minus task lateness (2 each), attendance lateness (1 each), and diesel
anomalies tied to the operator (5 each). Each contribution is computed and
stored separately so the manager UI can render a stacked-bar breakdown
without re-deriving the math, and so a Director can defend any payout to a
worker on appeal. Weights are constants in code today; later they move into
zameen.score_weight_overrides per entity when the policy evolves. No
machine learning, no opaque ranking.

### Worker sees only own score, not the full leaderboard
The field PWA exposes /me/score with the worker's composite, rank in
"N of M" form, and three sub-cards. It does not expose the full ordered
list. Rationale: in tight-knit Punjabi field teams, public ranking creates
interpersonal friction that outweighs the motivational benefit. The manager
dashboard at /labor/leaderboard shows the full ordered list because
supervisors need it to evaluate fairness and intervene.

### Bonus rules use a restricted JSONB DSL, not arbitrary code
bonus_rules.formula accepts a fixed set of filters
(minDaysPresent, maxDaysLate, maxTasksLate, maxDieselAnomalies,
minTasksCompleted, minPieceRateUnits) plus amount_kind in
(flat, percent_of_base, percent_of_piece_rate, top_n). This keeps rules
auditable, prevents accidental injection of expensive predicates, and lets
the Approver PWA render the rule in plain language. If a future bonus
structure needs more, we add a named filter, not an expression evaluator.

### Monthly cadence matches payroll
worker-score-monthly runs on the 2nd of the month at 03:00 PKT, scoring the
previous calendar month. The 2nd-not-1st gap allows late attendance edits
on the last day of the month to land before scoring. Bonus amounts are
stamped on the score row (bonus_amount_pkr) and rolled into the next
payroll run, where they go through the existing approval engine. We
deliberately do not auto-pay; payroll approval keeps a Director in the
loop on every bonus rupee.

### Diesel anomaly penalty only when operator_id is set
The penalty subtracts 5 per anomaly, but only when the daily log carries
operator_id matching the worker. If the operator is unrecorded (older logs,
shared tractor with no logbook discipline), the anomaly counts as
infrastructure noise, not against any individual. This avoids collective
punishment when a tractor misbehaves and the team can't be sure who was
driving.

### Gold/silver/bronze rendering uses brand accent variants, not gold
Top-3 cards use color-mix(in srgb, var(--accent) N%, var(--paper)) at
18%, 12%, and 7% to communicate ordering without introducing a foreign
gold or trophy palette. The brand is Pretext-monochrome with one accent;
adding a metallic-yellow tier would clash. The Trophy lucide icon in the
field PWA profile link is the one symbolic cue.

## 2026-05-18: Public marketing site, API docs, MF brief

### Public marketing at root, dashboard moved to /app/*

Visitors to agri.feerasta.ai used to hit the login wall directly. We now
serve a public marketing site at the root and the authenticated dashboard
moved to /app/* via a route segment inside the existing (dashboard) group.
The (marketing) route group renders for unauthenticated visitors and
redirects to /app when a Supabase session is present. Middleware was
updated with an explicit PUBLIC_PATHS allowlist (/, /features, /about,
/contact, /privacy, /terms, /api/docs, /openapi.json, /robots.txt,
/sitemap.xml) plus PUBLIC_PREFIXES for /login and /api/marketing/. The
trade-off: 19 directories were moved into (dashboard)/app/ but the nav
hrefs were the only call sites that needed updating, so the rename
blast-radius stayed small. Chose this over a /about subdomain because it
keeps SEO consolidated and matches how every modern SaaS marketing site
behaves.

### Swagger UI loaded from CDN, not bundled

The API docs page at /api/docs renders swagger-ui-dist 5.17 from jsDelivr
via a small client component that injects the script and stylesheet on
mount. Reasoning: swagger-ui-dist is roughly 1 MB minified and would
inflate the marketing bundle for a page that 5 people will ever load.
CDN-served keeps the marketing JS budget under 100 KB and means we never
ship the Swagger runtime to people who don't need it. The OpenAPI 3.1 spec
itself is hand-curated at apps/web/public/openapi.json; the
scripts/generate-openapi.ts script only validates and pretty-prints
because there is no widely-adopted Zod-to-OpenAPI bridge for Next route
handlers and we want the spec to mean exactly what we say it means.

### demo_requests is public-insert, admin-read

Lead capture from the contact page lands in zameen.demo_requests via the
service role from a Next route handler. The table has RLS enabled with a
single SELECT policy for director and super_admin roles. There is no
public INSERT policy because the route handler is the only path in and it
already does Zod validation, rate-limiting (10/hr/IP via the existing
rateLimit helper), and IP and user-agent capture. Notifying MF is
fire-and-forget via Resend; a Resend failure must not fail the lead save.

### MF brief and v1.0 release notes shipped as PDF

docs/mf-brief.md and docs/release-notes-v1.0.md are the source of truth;
apps/web/scripts/build-mf-brief.ts renders both to PDF using the existing
@react-pdf/renderer dependency. PDF is the right format because the brief
goes to family, lenders, and partners over WhatsApp where Markdown is not
a viable artifact. The template uses the existing deep-green and ochre
brand palette and includes a fixed footer with agri.feerasta.ai on every
page.

### GDPR-lite privacy policy

Pakistani law does not mandate a GDPR-style data-rights regime today. We
opted in anyway: export, deletion, correction, and access-log rights are
written into /privacy. No third-party trackers on the public site. No
analytics SDK. Plausible-style first-party page-view tracking happens only
behind auth, in middleware, and is already documented in the analytics
ADR.

### No third-party analytics on the public marketing site

The marketing pages are static React Server Components with no client JS
beyond the demo-request form. No Google Analytics, no Plausible, no
Vercel Analytics. The trade-off is we lose visibility into who is reading
/about, but the upside is the page passes audit-grade privacy hygiene and
loads under 100 KB JS. We can add a first-party page-view counter later
without dragging a third-party script in.

## 2026-05-18, Insurance and crop loans as first-class records

**Decision.** Insurance policies, claims, crop loans, and loan transactions live in their own
tables (zameen.insurance_policies, zameen.insurance_claims, zameen.crop_loans,
zameen.crop_loan_transactions) instead of being modeled purely as journal entries with metadata.

**Why.** MF needs a paper trail that an auditor or insurer adjuster can walk independent of
the GL. Insurers ask for documents organized by policy + claim, not by ledger period. Kissan
Card and Punjab agri-bank programs require quoting the loan number, lender name, and collateral
on every status touchpoint; embedding those in journal narration would be lossy. Journal entries
still post for every loan transaction and every paid claim, and reference the originating record
via source_module + source_record_id so audit can walk both sides.

**Alternatives considered.** Pure GL with rich metadata fields (too brittle for adjuster review,
search by claim number is awkward). Generic "documents" attached to journal lines (loses the
state machine for claims and the txn ledger per loan).

**Implications.** Two more state machines to maintain (claim status, loan status). Cross-table
joins for the loans dashboard. RLS routed via parent (claims via policy entity, loan txns via
loan entity). One new approval_type "insurance" and one new threshold tier.

## 2026-05-18, Claim photos are mandatory at submission

**Decision.** zameen.insurance_claims.photo_urls is jsonb default '[]' at the DB level, but the
server action createClaim rejects empty arrays. Reuses the PhotoUploader compression flow
(200 KB target, 1600px long edge).

**Why.** Every adjuster MF has worked with treats undocumented claims as fraud risk and either
discounts the settlement or stalls assessment. Capturing geo-tagged photos at incident time is
cheap insurance against later disputes. The cost of an uploaded photo (a few KB after
compression) is rounding error against the claim values being filed.

**Alternatives considered.** Warning-only on UI (would be skipped under time pressure, defeats
the audit purpose). Photos optional but required to move to assessor_done (loses the contemporaneous
evidence that makes adjusters trust the file).

**Implications.** Field-stationed workers must have the PWA camera path working offline; the
existing IndexedDB queue covers this.

## 2026-05-18, FIFO is surfaced, not enforced

**Decision.** The storage heat-map renders FIFO rank per storage location ("1·LOT123" = oldest
in that location) and the "Move oldest first" card calls out the top three lots aged ≥30 days
holding rank 1. We do not block dispatches that skip ahead in the FIFO order.

**Why.** Warehouse reality is dirtier than software wants it to be. Tractors break down, customer
trucks show up with the wrong crate count, a buyer specifically asks for a grade-A lot from a
particular field. Making the produce_movements server action reject out-of-order dispatch would
just push workers to back-date entries or skip recording moves entirely. Surfacing the FIFO
position lets supervisors self-correct without bureaucratic friction.

**Alternatives considered.** Hard FIFO enforcement (rejected for the reasons above). FIFO as a
post-hoc report (loses the at-a-glance signal that makes the heat-map valuable).

**Implications.** The shrinkage estimate (0.02% per day in storage) is heuristic; it will diverge
from actual measured shrinkage on the lot. We accept this because the goal is to draw the eye
to old inventory, not to compute the true write-down.

## 2026-05-18, Age bucket boundaries match agronomic shelf-life conventions

**Decision.** Buckets are 0-30d (fresh), 31-60d (acceptable), 61-90d (watch), 90-180d (sell-now),
180d+ (loss risk). Colors run green > lime > yellow > orange > red.

**Why.** Most field crops in this rotation (wheat, mustard, fodder) hit moisture-driven quality
inflection points around the 60-90 day mark in unconditioned storage. Maize stored over 180d
without phosphine fumigation is essentially written down. The breakpoints match what the
warehouse foreman would intuit; using e.g. weekly buckets would be precise but illegible.

**Alternatives considered.** Crop-specific shelf-life curves (defensible but data-hungry and
hard to display in one grid; revisit when there is enough harvested-to-sold telemetry to fit
real curves per crop).

**Implications.** A single shrinkage heuristic applies across crops, which understates risk for
maize and overstates for wheat. Acceptable for v1.

## 2026-05-18, Kissan Card as a named lender_kind

**Decision.** The lender_kind check constraint enumerates 'kissan_card' as a distinct lender
kind alongside 'agri_bank' and 'commercial_bank'.

**Why.** Punjab's Kissan Card pilot has unique disbursement, repayment, and reporting
expectations (per-acre limit, season-tied repayment, subsidy reimbursement to the lender). Folding
it into 'agri_bank' would force downstream reporting to special-case it via free-text. Naming it
explicitly lets us produce a Kissan Card register on demand without text-matching lender names.

**Alternatives considered.** Generic lender_kind with a separate program_name field (more flexible
but loses the type discipline; reporting code would always have to defensively coerce).

**Implications.** If the federal Kisan e-Credit (Sindh) program comes online and behaves
differently, we will add it as another named kind rather than overloading 'kissan_card'.

## 2026-05-18, Playwright e2e harness for the pilot golden path

**Decision.** Adopt Playwright (not Cypress) for end-to-end coverage of the worker-to-director flow plus every critical mutation. Specs live under `e2e/specs/`, helpers under `e2e/helpers/`, fixtures under `e2e/fixtures/`. CI runs the full suite against an ephemeral Supabase on main pushes and on PRs labelled `run-e2e`. A separate smoke workflow polls production every 15 minutes and after each `deploy-prod`.

**Why.** Playwright drives the four Next.js shells (web, field, ops, approve) in one process, gives native trace + video on failure, and handles multiple isolated browser contexts in a single test (needed for cross-role flows like worker submits then director approves). Cypress' iframe-based approach struggles with cross-origin app shells and lacks built-in service-worker offline emulation that spec 09 leans on.

**Alternatives considered.** Cypress (one-runner-per-tab limitation, weaker multi-context support); Selenium (slower, more flakey, fewer ergonomics); pure API integration tests (would miss PWA offline queue, GPS capture, file-upload validation, hydration regressions).

**Implications.**
- Per-test entity isolation via a random `e2e-<rand>` tag in `code`/`name` columns keeps parallel runs safe and makes cleanup a one-liner. Service-role admin client handles setup/teardown so we are not paying UI-click latency for every seed step.
- Smoke spec is prefix `00-` and lives alone in the production polling workflow. The remaining 15 specs only run against ephemeral Supabase so we never write `e2e-` rows to production.
- OCR (spec 13) and AI feasibility (spec 10) are gated on `OPENAI_API_KEY` so PRs do not burn external API spend.
- RLS isolation (spec 15) is an explicit security test, not a happy-path test. It hits Supabase directly with anon-key auth to prove that an authenticated entity-A user cannot read entity-B rows via the data API, then verifies UI-level deny at `/app/fields/<id>`. Catches the worst-case multi-tenant leak class before it reaches pilots.
- Trace on first retry, screenshot + video on failure, 60s global timeout, 10s expect timeout. `E2E_SEQUENTIAL=1` opts into serial execution for flake hunts.


---

## Pilot onboarding kit (2026-05-18)

**Decision.** Ship a five-piece onboarding kit before the Rabi 2025-26 pilot: Urdu Nastaliq
worker handbook, bilingual supervisor manual, three short screen-recording video scripts (worker
90 seconds, supervisor 3 minutes, MF approver 1 minute), a laminated A5 quick-reference card
for the tea room, and a T-7/Day-0/Week-1/Day-30 launch checklist for MF.

**Why Urdu Nastaliq, not Roman Urdu, for the worker handbook.** Workers identify their own
language by script. Showing them Roman Urdu signals "this was not made for you." Nastaliq plus
heavy emoji (📷 🎤 ✅ 🚜) carries low-literacy users further than romanisation does. PDF
generation registers Noto Nastaliq Urdu from a CDN at build time and forces RTL layout.

**Why the supervisor manual is bilingual.** Supervisors switch contexts: Urdu with workers,
English in the ops app, English-ish numbers with the farm manager. Side-by-side bilingual is
faster to scan than two separate documents.

**Why a laminated card and not just digital.** Phones die mid-day. The card hangs in the tea
room and survives spills, monsoon, and forgotten chargers. A5 landscape so it fits a clipboard
and is large enough to read across a room.

**Why three video lengths, not one.** Attention budgets differ: a worker watches 90 seconds on
WhatsApp before the next forward, a supervisor sits through 3 minutes if it teaches the daily
rhythm, MF watches 60 seconds because the approver flow is already short.

**Why the checklist splits T-7, Day 0, Week 1, Day 30.** Anchors expectations and prevents the
classic launch-day cram. T-7 is provisioning. Day 0 is the first ticks. Week 1 captures the
friction. Day 30 is the first honest review against the seasonal numbers.

**Alternatives considered.** A single bilingual handbook (rejected; bilingual documents read
as half-Urdu for workers, which is worse than monolingual Urdu). Long-form video tutorials
(rejected; workers will not finish them, supervisors will not rewatch them). Digital-only
quick reference (rejected; tea room is offline). A printed monthly playbook (rejected; would go
stale and lose authority).

**Implications.** The web app exposes three new build scripts (`build-worker-handbook`,
`build-supervisor-manual`, `build-quick-reference`) that emit PDFs into `docs/`. The field PWA
gets a separate eight-step in-context tour (`worker-field-pwa-tour.ts`) distinct from the
`/training` sandbox: the tour runs against the real UI on first login, the sandbox is a safe
place to practice. Reissue cycle: handbook and quick-reference reprinted at each season change,
videos reshot only when a flow materially changes.

## 2026-05-18 Security hardening for pilot launch

Real PKR financial flows go live with the Rupafab pilot. Defensive measures
added now rather than after-the-fact:

- **Secret scanner** runs in pre-commit + CI. Defense in depth: a missed
  scan locally still catches at the PR gate. Allow-list scoped to
  `.env.example`, `docs/`, and `*.md` so placeholder examples don't trip it.
- **Log redaction by key heuristic** (`packages/shared/src/redact.ts`).
  Rejecting "log nothing" because incident triage needs structured context;
  rejecting "log everything raw" because Loki retains 30 days. Compromise:
  case-insensitive key match against a 15-name allow-deny list plus a
  token-shape heuristic on long alnum strings. False positives are fine
  (we'd rather drop a base64 image preview than a service-role JWT).
- **Property-based RLS fuzz over 28 tables** (`16-rls-isolation-fuzz.spec.ts`).
  Tests-as-policy: every new `entity_id` table adds a row here and the
  next CI run proves no leak. Cheaper than handwritten per-table tests
  and catches the case where a developer forgets to write any test.
- **Magic-number MIME validation** (`apps/*/src/lib/file-validation.ts`).
  Never trust `Content-Type` from the client. Wired into receipts and R2
  presign multipart paths; signed-URL JSON path stays untrusted because
  Cloudflare R2 will reject non-image bodies via bucket policy.
- **PublicError pattern** (`packages/shared/src/errors.ts`). Routes throw
  `PublicError(msg, code)` when the message is user-safe; any other throw
  becomes "Something went wrong" with the real error logged via
  `safeStringify`. Stops Postgres unique-constraint messages from leaking
  table/column names to the browser.
- **CSP report-only first, then enforce**. Enforcing CSP on a complex
  multi-app site with Mapbox, Sentinel Hub, Supabase realtime, and inline
  styles risks breaking real flows for a vague headline of "more secure".
  One week of report-only traffic into `zameen.csp_violations` (admin-RLS
  read, anon insert) gives us the data to tighten directives without
  blocking the pilot.

## Open-Meteo + NASA POWER weather integration (2026-05-18)

- **Open-Meteo over OpenWeather**: free, no API key, built-in agroclimatology
  (FAO Penman-Monteith ET0, soil moisture at four depths, 16-day forecast,
  hourly granularity). OpenWeather requires a paid plan for ET0 and soil
  moisture, and caps forecasts at 5 days on the free tier.
- **NASA POWER for 40-year normals**: keyless, community 'AG' tuned for
  agriculture, daily resolution back to 1981. Used to compute monthly mean
  temperature, total rainfall, and ET0 baselines so the platform can flag
  anomalies (e.g. "March 2026 was 2.3C above the 1984-2024 mean").
- **Hourly cache split from daily**: `zameen.weather_hourly` is upserted on
  every 3-hour pull while `zameen.weather_records` keeps the one-row-per-day
  contract existing consumers depend on. The hourly cache powers spray
  windowing (06-09 vs 17-19) and frost-hour counting.
- **GDD computed per-crop from base temperature**: wheat 5C, maize 10C,
  cotton 15C, with sensible defaults for other crops. Base temperatures are
  hard-coded in `open-meteo.ts` rather than pushed to `crop_profiles` for v1
  to avoid a seed migration; can move later if customers need overrides.
- **Frost detection from hourly subzero counts**: daily min temperature
  underestimates frost severity. Counting hours below 2C in the next 24-48h
  is far more actionable for protective irrigation calls.
- **Backwards compatibility**: existing `weather_records` columns are
  untouched. New columns are nullable and additive. Downstream readers
  (spray-planner, weather-alert-checker) keep working with daily aggregates
  and opt into ET0/soil/frost data only where it improves the decision.

## 2026-05-18 Free public APIs: SoilGrids, OpenAQ, Overpass, PlantNet

Four keyless or nearly-keyless integrations added to enrich Zameen without
adding subscription cost or building proprietary data pipelines for v1.

- **ISRIC SoilGrids 250m raster** as a baseline soil profile. The Raiwind
  pilot starts before any commercial lab visit, and waiting on lab turnaround
  is two-to-three weeks of guesswork on fertiliser plans. SoilGrids gives us
  pH, organic carbon, clay/sand/silt fractions, bulk density and CEC down to
  30 cm anywhere in the world. Auto-fetched on field creation at the polygon
  centroid; first soil_tests row is auto-seeded with laboratory =
  "SoilGrids 250m raster" so dashboards always have a profile. The UI is
  explicit that this is a model output, not a lab result, and prompts a real
  test before fertiliser decisions. Cached on the field row forever (250m
  raster does not move).
- **OpenAQ** for Lahore smog. Winter AQI routinely exceeds 300 in the Lahore
  basin and that has a 1.5x worker-health and roughly 15% photosynthesis
  impact vs. clean-air baselines. Hourly poller (06:00-20:00 PKT) inserts a
  reading per entity; AQI >= 200 dispatches a smog notification to directors
  and supervisors recommending spray postponement and masks. Field dashboard
  surfaces current AQI next to weather. AQI computed via EPA breakpoints from
  PM2.5 and PM10, dominant pollutant wins.
- **OpenStreetMap Overpass** for nearby mandis, canals, roads, tubewells,
  mosques and hospitals. Drives mandi-dispatch routing, irrigation planning
  (which canals connect), logistics, and groundwater context (other tubewells
  in the area). Public Overpass instances are rate-limited, so results are
  cached per field for 30 days in zameen.nearby_features_cache. We do not
  hammer the public endpoint on every page view.
- **PlantNet** as a Claude-vision fallback. When Claude's crop diagnostic
  returns < 0.6 confidence we ask PlantNet for a second opinion. PlantNet is
  strong on species/family identification but weak on pest or disease
  labelling, so it complements rather than replaces Claude. When PlantNet is
  confident (>= 0.7) and shares a family or genus token with Claude's label,
  we boost the combined confidence by 0.15 and store the secondary
  identification. PLANTNET_API_KEY is optional; missing key short-circuits
  gracefully without affecting Claude's primary path.

All four APIs are keyless except PlantNet (free tier 500-1000 calls/day).
Each call has a 30s timeout and one retry. No Sentinel Hub or Haazri
coupling: these are independent of the satellite pipeline and the cross-app
auth tables.

## 2026-05-18 — FAO Locust, SBP FX, PBS mandi prices, NASA MODIS+SMAP

Four free public data sources added to complement Sentinel-2 NDVI and Open-Meteo
without coupling to Sentinel Hub or Haazri.

FAO Locust Hub: public ArcGIS FeatureServer, no API key. We query a 500km
buffer around the entity farm centroid weekly for swarms reported in the last
90 days. Gregarious swarms within 100km trigger a push to director plus farm
manager. Centroid defaults to Raiwind (31.2538, 74.1234) when farm coords are
missing.

SBP FX: rather than scrape the SBP M2M HTML page, we use exchangerate.host's
free JSON endpoint. It tracks SBP within a few percent and gives us a stable
schema. The SBP scrape URL is kept as a future fallback. Six PKR pairs covered:
USD, EUR, GBP, AED, SAR, CNY. Daily 09:00 PKT.

PBS / pricecheck.gov.pk: the PBS bulletins are irregular HTML/Excel and the
layout shifts. We hit pricecheck.gov.pk's JSON endpoint first. On failure the
poller returns inserts=0 with a note so the UI can prompt for manual entry.
Phase 1 risk is acceptable; manual entry is the existing path anyway. Monday
08:00 PKT after Friday/Saturday publication.

NASA AppEEARS for MODIS MOD13Q1 NDVI (250m, 16-day cadence) and SMAP SPL3SMP_E
soil moisture (9km, daily). AppEEARS is async (login -> task -> poll -> bundle
-> CSV) so the poller is slow and runs once a week, not in real time. MODIS
fills the every-5-day Sentinel-2 gap with daily-cadence data at 25x coarser
resolution; we treat it as cross-validation, not a replacement. SMAP is L-band
microwave so it sees soil moisture even through clouds, which is the point.
NASA Earthdata credentials are required and the poller no-ops gracefully when
they're missing.

All four pollers reuse the existing instrument() job_runs wrapper. Each fetch
has a 30s (or 60s for AppEEARS) timeout and one retry. No coupling to
Sentinel Hub auth or Haazri tables.

## Pakistan time + advisory API integrations

- **Nager + Aladhan combined for Pakistan holiday coverage**. Nager exposes
  gazetted public holidays but misses several PK observances (Iqbal Day,
  Defence Day, anniversary holidays); Aladhan provides authoritative Hijri +
  Eid/Ramadan windows. We merge both and dedupe by (date, lowercase name),
  then overlay a small static supplement for the gaps. Both APIs are free and
  keyless; 30s timeout with single retry per upstream.
- **Aladhan for Ramadan + Eid windows**. Authoritative for the Sunni Hanafi
  convention common across Punjab, including Lahore where the Raiwind farm
  sits. Pulled daily for the iftar/sehri banner on the Field PWA so workers
  see an Urdu countdown while attendance posting.
- **Monsoon forecast Phase 1 via NASA POWER normals**. PMD does not publish a
  public long-range API; their seasonal outlook PDF arrives mid-May and is
  paywalled. Phase 1 derives a coarse normal / above / below indicator by
  comparing this-year June precipitation to the 40-year POWER baseline,
  centered on a climatological 1 July onset with a 7-day shift band. Cheap,
  good enough to anchor the sowing/harvest tile until Phase 2 wires PMD.
- **Advisory ingestion manual via PDF upload**. PARC and FAO Pakistan publish
  weekly/monthly bulletins as PDFs without an API or stable feed. Admin uploads
  the PDF URL on /app/admin/advisories; Claude vision extracts an English
  summary + Urdu translation + commodity tags + recommendations. Beats brittle
  scrapers and keeps a human in the loop for quality.
- **FAO crop calendar baked as static JSON**. Sowing + harvest windows shift
  less than once a year and are jurisdictional rather than data-driven. A
  curated `packages/shared/src/lib/pakistan-crop-calendar.json` covers the 12
  major Punjab crops and powers pre-fill on the new crop-plan form plus
  out-of-window warning toasts.
- **Holiday-aware payroll divisor**. Pakistani agricultural-labour convention
  pays through public + religious holidays, so the default `holidayPolicy`
  in `entity_settings.units_config` keeps both as worked. Entities can flip
  either flag, and `computeNetPay` subtracts qualifying holidays from the
  divisor before dividing salary, never letting the divisor drop below 1.
