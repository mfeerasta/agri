#!/usr/bin/env bash
# Orchestrate the full Zameen migration + seed sequence in the correct order.
# Idempotent at the SQL level (all migrations use IF NOT EXISTS / OR REPLACE).
#
# Order:
#   1. supabase/migrations/0001_init_zameen_schema.sql
#   2. pnpm --filter @zameen/db migrate     (Drizzle-generated DDL)
#   3. supabase/migrations/0002_rls_policies.sql
#   4. supabase/migrations/0003_storage_buckets.sql
#   5. supabase/migrations/0004_cron_and_triggers.sql
#   6. supabase/migrations/0005_cnic_encryption.sql
#   7. supabase/migrations/0006_geometry_columns.sql
#   8. supabase/migrations/0007_rpc_functions.sql
#   9. supabase/migrations/0008_idempotency.sql
#  10. pnpm --filter @zameen/db seed
#  11. supabase/scripts/inject-runtime-config.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MIG_DIR="$ROOT_DIR/supabase/migrations"

# Source .env if it exists. Tolerates spaces and quotes.
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

DATABASE_URL="${DATABASE_URL:-}"
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL must be set (env or .env)" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found on PATH" >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found on PATH" >&2
  exit 1
fi

run_sql() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "SKIP (missing): $file"
    return 0
  fi
  echo "APPLY: $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
}

echo "=== Step 1: init schema ==="
run_sql "$MIG_DIR/0001_init_zameen_schema.sql"

echo "=== Step 2: Drizzle migrations ==="
pnpm --filter @zameen/db migrate

echo "=== Step 3: RLS policies ==="
run_sql "$MIG_DIR/0002_rls_policies.sql"

echo "=== Step 4: storage buckets ==="
run_sql "$MIG_DIR/0003_storage_buckets.sql"

echo "=== Step 5: cron and triggers ==="
run_sql "$MIG_DIR/0004_cron_and_triggers.sql"

echo "=== Step 6: CNIC encryption ==="
run_sql "$MIG_DIR/0005_cnic_encryption.sql"

echo "=== Step 7: PostGIS geometry columns ==="
run_sql "$MIG_DIR/0006_geometry_columns.sql"

echo "=== Step 8: RPC functions ==="
run_sql "$MIG_DIR/0007_rpc_functions.sql"

echo "=== Step 9: idempotency log ==="
run_sql "$MIG_DIR/0008_idempotency.sql"

echo "=== Step 10: seed (full) ==="
pnpm --filter @zameen/db seed

echo "=== Step 11: inject runtime config ==="
bash "$ROOT_DIR/supabase/scripts/inject-runtime-config.sh"

echo ""
echo "All migrations applied, data seeded, runtime config injected."
