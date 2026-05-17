# Zameen Hetzner Deployment

## Server provisioning

1. **VPS**: dedicated Hetzner CPX31 (4 vCPU, 8 GB RAM, 160 GB NVMe) in Falkenstein, named `zameen-prod`. Co-located with Sentinel/Haazri in the same Hetzner project for shared networking.
2. **OS**: Ubuntu 24.04 LTS.
3. **Inbound firewall (Hetzner Cloud Firewall)**: only `80`, `443`, `22` from your IP. All inbound app ports (3000-3003, 54321-54323) blocked from the internet.
4. **DNS** in Cloudflare:
   - `agri.feerasta.ai`, `field`, `ops`, `approve`, `api` → A record to VPS IP, proxied (orange cloud).
   - Cloudflare SSL mode: `Full (strict)`.
5. **Cloudflare Tunnel** (optional, recommended): expose only via tunnel, drop public 80/443 from firewall.

## First-time setup on the VPS

```bash
apt-get update && apt-get install -y docker.io docker-compose-plugin git
systemctl enable --now docker

# clone
git clone git@github.com:feerasta/zameen.git /opt/zameen
cd /opt/zameen

# .env from secrets manager (Doppler)
doppler setup --project zameen --config prod
doppler secrets download --no-file --format docker > .env

# bring up
docker compose up -d --build
```

## Database

Shared Supabase project `qcvxefbrzkspoldjydrx` (co-tenant with Haazri). Zameen tables live in the `zameen` schema (see `supabase/migrations/0001_init_zameen_schema.sql`). Haazri keeps `public`. Cross-schema joins are granted for unified worker IDs.

To apply migrations on the live Supabase project:

```bash
# 1. Bootstrap schema and extensions
psql "$DATABASE_URL" -f supabase/migrations/0001_init_zameen_schema.sql

# 2. Drizzle table migrations
pnpm db:generate     # only if schema files changed
pnpm db:migrate      # applies migrations/*.sql against $DATABASE_URL

# 3. RLS + storage buckets
psql "$DATABASE_URL" -f supabase/migrations/0002_rls_policies.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_storage_buckets.sql

# 4. Seed crops, COA, approval workflows for AGRI
pnpm db:seed
```

## Deploys

```bash
cd /opt/zameen
git pull
docker compose build
docker compose up -d
docker compose logs -f --tail=50
```

Rolling restart pattern (one app at a time) to avoid full outage:
```bash
docker compose up -d --build --no-deps web
docker compose up -d --build --no-deps field
docker compose up -d --build --no-deps ops
docker compose up -d --build --no-deps approve
```

## Backups

- Supabase managed (point-in-time recovery, 7 day window) — no action needed.
- Cloudflare R2 photo bucket: lifecycle rule keeps everything, no expiry.
- VPS itself is stateless; everything material lives in Supabase + R2.

## Monitoring

- Cloudflare Analytics for HTTP traffic.
- `docker compose logs` shipped to Better Stack (or Loki) via Vector sidecar (Phase 2).
- Supabase project health dashboard for DB stats and slow queries.
