# Zameen Deployment Runbook

Operational guide for deploying and operating the Zameen platform for Rupafab Agri. Primary domain `agri.feerasta.ai`. Production target is a Hetzner CPX31 VPS running Docker Compose behind Caddy, fronted by Cloudflare DNS, backed by a shared Supabase project (`qcvxefbrzkspoldjydrx`, co-tenant with Haazri).

This runbook is the source of truth for going from a clean Hetzner Cloud account to a working production deploy with users onboarded. Every script referenced here is committed under `deploy/`. Every script is idempotent and safe to re-run.

## 1.1 Prerequisites

Accounts and access you must have before starting:

- **Hetzner Cloud** account with billing set up, an existing project (where Sentinel and Haazri already live), an SSH keypair uploaded.
- **Cloudflare** account that owns `feerasta.ai`. DNS already managed there.
- **Cloudflare R2** with one bucket for production photos (`zameen-photos`) and one for database dump archives (`zameen-backups`). Generate one API token with Object Read/Write scoped to both buckets.
- **Doppler** for secret management. Project `zameen`, configs `dev` / `staging` / `prod`. A service token for the prod config is what the VPS uses. If Doppler is unavailable, the fallback is a hand-pasted `/opt/zameen/.env`.
- **GitHub** repo `feerasta/zameen` with a deploy key registered on the VPS (read-only).
- **SSH keypair** for the `deploy` user on the VPS. Public key goes in `~/.ssh/authorized_keys`, private key stays on your laptop.
- **Supabase** project `qcvxefbrzkspoldjydrx` already created. Service-role key, anon key, and Postgres connection string in hand.
- **Meta Business** account with a WhatsApp Business API number provisioned. Permanent token, phone number ID, business account ID.
- **Resend** API key for transactional email from `notifications@agri.feerasta.ai`. Sender domain verified.
- **OpenAI** API key for the diesel anomaly detector edge function. Anthropic key optional, used by the same function as a fallback.
- **Mapbox** token for field polygon rendering (Phase 1 read-only, editor lands later).

## 1.2 Provision the VPS

In Hetzner Cloud Console:

1. Open the existing project that already contains Sentinel and Haazri.
2. New server: location Falkenstein (DE), image Ubuntu 24.04 LTS, type CPX31 (4 vCPU, 8 GB RAM, 160 GB NVMe), networking IPv4 + IPv6, attach your SSH public key, name `zameen-prod`.
3. Assign a floating IP and attach it. Use that IP everywhere downstream so the underlying server can be swapped without touching DNS.
4. Apply the existing `web-public` firewall (ports 22/tcp from your IP, 80/tcp + 443/tcp from anywhere, all other inbound denied). If no such firewall exists, create one with those rules.
5. Note the floating IP. This is `$VPS_IP` for the rest of the runbook.

## 1.3 First boot setup

SSH in as `root`, then run the bootstrap script committed to this repo:

```bash
ssh root@$VPS_IP
curl -fsSL https://raw.githubusercontent.com/feerasta/zameen/main/deploy/bootstrap-vps.sh | bash
```

The script (`deploy/bootstrap-vps.sh`) is idempotent and does all of the following:

- Updates apt, installs `docker.io`, `docker-compose-plugin`, `git`, `ufw`, `fail2ban`, `curl`, `gnupg`, `cron`, `awscli`.
- Creates a `deploy` user with sudo and a `docker` group membership.
- Installs the Doppler CLI from their apt repo.
- Configures `ufw`: default deny incoming, allow outgoing, allow 22/80/443 inbound. Enables it.
- Configures `fail2ban` with the default sshd jail.
- Clones the repo to `/opt/zameen` via the GitHub deploy key (script generates the keypair on first run, prints the public key, and waits for you to paste it into GitHub before continuing if the clone fails).
- Creates `/opt/zameen/.env` by running `doppler secrets download` if a `DOPPLER_TOKEN` env var is present, otherwise drops a stub `/opt/zameen/.env` from `.env.example` for manual editing.
- Installs a systemd timer `zameen-autopull.timer` that runs weekly on Sunday 03:00 UTC, doing `git pull` followed by `docker compose pull && docker compose up -d --remove-orphans`. This catches base image security patches without code changes.
- Installs the daily backup cron at 02:30 UTC pointing at `deploy/backup.sh`.

The script is safe to re-run. Every step checks for prior state.

## 1.4 Cloudflare DNS

In the Cloudflare dashboard for `feerasta.ai`:

1. Add A records (proxied, orange cloud):
   - `agri` → `$VPS_IP`
   - `field.agri` → `$VPS_IP`
   - `ops.agri` → `$VPS_IP`
   - `approve.agri` → `$VPS_IP`
   - `api.agri` → `$VPS_IP`
2. SSL/TLS mode: Full (strict). Caddy on the VPS issues a Let's Encrypt cert via HTTP-01 against the Cloudflare proxy, which is why we keep 80 open at the firewall.
3. Optionally, install `cloudflared` on the VPS and create a Cloudflare Tunnel to remove public 80/443 entirely. The tunnel ID and credentials go into `/etc/cloudflared/config.yml`. With a tunnel active, drop 80/443 from the Hetzner firewall. This is recommended once the platform is past the pilot.

## 1.5 Supabase setup

The Supabase project already exists (shared with Haazri). Zameen lives in the `zameen` schema. Haazri stays in `public`. Cross-schema reads require grants which the migrations apply.

Apply migrations in numeric order from a workstation with `$DATABASE_URL` pointing at the production Postgres:

```bash
cd /path/to/zameen
export DATABASE_URL="postgresql://postgres.qcvxefbrzkspoldjydrx:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# 1. Schema, extensions, RLS, storage buckets, cron, geometry, RPC.
for f in supabase/migrations/*.sql; do
  echo ">> applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# 2. Drizzle table migrations.
pnpm db:migrate

# 3. Inject runtime config (pg_cron JWT etc.) into vault.
bash supabase/scripts/inject-runtime-config.sh

# 4. Seed: AGRI entity, Raiwind Farm, crop library, chart of accounts, default approval workflows.
pnpm db:seed
```

Deploy edge functions. The eight functions under `supabase/functions/` are:

```bash
supabase link --project-ref qcvxefbrzkspoldjydrx
for fn in approval-escalation cloudflare-r2-presigned-url daily-task-generator diesel-anomaly-detector field-pl-calculator irrigation-reminder weather-puller whatsapp-webhook; do
  supabase functions deploy "$fn" --no-verify-jwt
done
```

Storage buckets `zameen-photos`, `zameen-receipts`, `zameen-reports` are created by migration `0003_storage_buckets.sql`. Verify via Studio.

## 1.6 Initial deploy

On the VPS as `deploy`:

```bash
cd /opt/zameen
git pull origin main
# Confirm every key in .env.example has a value in /opt/zameen/.env.
diff <(grep -oE '^[A-Z_]+=' .env.example | sort) \
     <(grep -oE '^[A-Z_]+=' .env            | sort)
docker compose build --build-arg APP_VERSION=$(git rev-parse --short HEAD)
docker compose up -d
docker compose logs -f --tail=50
```

Caddy auto-issues TLS for the four subdomains on first request. The `api.agri.feerasta.ai` host is reserved and currently returns 404.

CI builds and pushes images to GHCR on every push to `main`. The simpler production flow is `docker compose pull && docker compose up -d` once `image:` lines in `docker-compose.yml` switch to the GHCR refs. The runbook keeps `build:` locally for now to keep ops simple during the pilot.

## 1.7 Onboarding pilot users

Open Supabase Studio for `qcvxefbrzkspoldjydrx`. In `auth.users`, create phone-OTP accounts:

- MF (Meer Feerasta) - role `director`, default_entity_id = AGRI.
- Ali (farm manager) - role `farm_manager`.
- Imran and Shahid (supervisors) - role `supervisor`.
- Two-to-three workers - role `worker`.

Insert matching rows in `zameen.users` with the same UUID, the entity binding, role, and Urdu display name. Use the script `supabase/seed/onboard-pilot-users.sql` (parameterised by phone numbers).

Workers and supervisors sign in at `https://field.agri.feerasta.ai`. The farm manager uses `ops.agri.feerasta.ai`. MF uses `approve.agri.feerasta.ai` for decisions and `agri.feerasta.ai` for the management dashboard.

## 1.8 Smoke tests

Run these end-to-end after the initial deploy. All four should pass before declaring the pilot live.

1. **Worker diesel log.** A worker signs into the field PWA, opens Diesel, logs 8 litres for tractor T1 against Field A on crop plan Wheat-2025-Rabi. Submits. The entry appears in the management dashboard within five seconds and is allocated to `cost_pool='diesel'`, `field_id=A`. Below the auto-approval threshold so no approval is needed.
2. **Repair under threshold.** A supervisor submits a Rs. 8,000 belt replacement for tractor T1. The approval engine routes it back to supervisor self-approve (within their threshold). The work order opens immediately, audit row records the supervisor's own approval.
3. **Fertilizer above threshold.** The farm manager submits a Rs. 75,000 DAP purchase. Routes to MF. Notification fires via WhatsApp (deep link) and email (Resend). MF opens approve PWA, sees `contextSnapshot` (cash position from cash book, recent DAP purchases, supplier history, attached photos), taps Approve. The execution path commits the inventory increase, the journal entry (debit Inventory, credit Cash), and the cost allocation, all with the same `approval_request_id` for audit walk.
4. **Per-field P&L.** From the web app, open Wheat-2025-Rabi, click P&L. The numbers must include the diesel from test 1 and the DAP from test 3, all in PKR with the `<Pkr>` component, never raw locale formatting.

If any of these fails, do not onboard more users until the failure is understood. Approval routing failures are almost always wrong thresholds in `approval_workflows`; check that table first.

## 1.9 Backup and disaster recovery

- **Database.** Supabase managed point-in-time recovery with a seven-day window. No setup needed.
- **Photo storage.** Cloudflare R2 bucket `zameen-photos` has no lifecycle expiry. Versioning is on. R2 is replicated within Cloudflare, no further action needed.
- **Daily logical dump.** Cron on the VPS runs `deploy/backup.sh` at 02:30 UTC. The script does `pg_dump --format=custom --schema=zameen` of the production database, gzips, names by date, and uploads to R2 bucket `zameen-backups`. Lifecycle rule on that bucket: delete objects older than 30 days. The script writes a JSON manifest of the day's dump (size, sha256, row counts for the eight largest tables) next to the dump.
- **Restore drill.** Quarterly: spin up a Hetzner CPX21 sandbox box, run `deploy/bootstrap-vps.sh` against a staging Supabase project, pull the most recent R2 dump, `pg_restore` into the staging DB, run `pnpm db:seed --skip-existing`, then verify by computing `computeFieldPnL('wheat-2025-rabi')` against staging and against prod and confirming the numbers match within a paisa.

## 1.10 Monitoring

- **HTTP traffic.** Cloudflare Analytics, no setup.
- **DB and auth health.** Supabase project dashboard, plus weekly review of slow query log.
- **App logs.** `docker compose logs --tail=200` for spot checks. Phase 2 ships a Vector sidecar streaming to Loki at the Sentinel observability stack. Until then, no central aggregation.
- **Uptime ping.** A separate machine (Sentinel or a cheap UptimeRobot-like) hits `/api/health` on each of the four subdomains every five minutes. The route is implemented at `apps/<app>/src/app/api/health/route.ts` and returns `{ ok: true, version, ts }` with `cache-control: no-store`. The script `deploy/health-check.sh` is the local equivalent and exits non-zero on any failure, suitable for an external cron.
- **Approval escalations.** The `approval-escalation` edge function posts to `DEPLOY_SLACK_WEBHOOK` when an approval has been pending more than its SLA window.

## 1.11 Updating production

Standard rolling deploy:

```bash
cd /opt/zameen
git fetch && git checkout <sha>
docker compose build --build-arg APP_VERSION=<sha>
for svc in web field ops approve; do
  docker compose up -d --build --no-deps "$svc"
  sleep 10
  curl -fsS "https://${svc/web/agri}${svc/web/}.feerasta.ai/api/health" || { echo "health failed for $svc"; exit 1; }
done
```

Database migrations are a PR review gate. After merge, run from the CI runner (not the VPS) with `$DATABASE_URL` pointing at production:

```bash
pnpm db:migrate
```

Edge function updates: `supabase functions deploy <fn> --no-verify-jwt` for cron-triggered functions, drop the `--no-verify-jwt` for HTTP-callable ones (e.g. `cloudflare-r2-presigned-url` which is called from the field PWA and uses Supabase auth).

## 1.12 Incident playbook

- **App container down.** `docker compose ps` to confirm, `docker compose logs <svc> --tail=200` to inspect, `docker compose up -d --no-deps <svc>` to bring back. If it crash-loops, check `/opt/zameen/.env` against `.env.example` for missing keys.
- **DB unavailable.** Open Supabase status page. If degraded, escalate via Supabase support. If the project itself is bad, restore from PITR via the dashboard. Last-resort: `pg_restore` from the most recent R2 dump into a fresh project, then update `$DATABASE_URL` in `/opt/zameen/.env` and `docker compose restart`.
- **Photo uploads failing.** Check R2 quotas in the Cloudflare dashboard. Inspect the `cloudflare-r2-presigned-url` edge function logs. Confirm `CLOUDFLARE_R2_*` env vars are present in the running container with `docker compose exec web printenv | grep R2_`.
- **Approval queue stuck.** Run `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;` against the production DB. If `approval-escalation` is failing, check the function's logs in Supabase Studio. If the job is fine but requests sit in `pending`, look for a missing approver row (FK violation hidden as a soft state).
- **Caddy TLS error.** `docker compose logs caddy --tail=200`. Usually the Cloudflare proxy is set to Flexible instead of Full (strict), or Caddy lost its ACME account state. Volume `caddy_data` carries that state; restore from yesterday's R2 dump if needed.
- **Lost VPS.** Provision a fresh CPX31 with the same SSH key, run `deploy/bootstrap-vps.sh`, point the floating IP at the new server, wait for DNS TTL, then `docker compose up -d`. No state lives on the VPS that is not also in Supabase or R2; total time to recover under thirty minutes.

## Appendix: Database migration sequence

The database migration and seed flow has its own orchestrator at
`supabase/scripts/migrate-all.sh`. Full step ordering and rationale lives in
`packages/db/migrations/README.md`. The two scripts you need on any new
environment are:

```bash
# One-shot fresh-database bring-up (idempotent at the SQL level).
bash supabase/scripts/migrate-all.sh

# Refresh runtime config only (when rotating the service role JWT or CNIC key).
bash supabase/scripts/inject-runtime-config.sh \
  "$DATABASE_URL" \
  "$SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL" \
  "$ZAMEEN_CNIC_KEY"
```

Why runtime config is injected from a shell script (not from a migration): the
service role JWT, Supabase URL, and CNIC encryption key are secrets and
environment-specific. They live outside the committed SQL and are written to
the database parameter store via `alter database postgres set app.<key> = ...`.
`pg_cron` workers and pgcrypto wrappers read them with
`current_setting('app.<key>', true)`.

The seed (`pnpm --filter @zameen/db seed`) must run AFTER
`0006_geometry_columns.sql` because field and block geometry inserts go through
the `zameen.geom_from_json(text)` PostGIS helper created by that migration.
