#!/usr/bin/env bash
# Inject Supabase runtime config into Postgres so pg_cron + zameen.invoke_edge_function
# can call edge functions and pgcrypto can find the CNIC key. Run AFTER all
# migrations have been applied. Idempotent: rerunning overwrites previous values.
#
# Usage:
#   ./inject-runtime-config.sh "$DATABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_URL" "$CNIC_KEY"
# or rely on environment:
#   DATABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... ZAMEEN_CNIC_KEY=... ./inject-runtime-config.sh

set -euo pipefail

DATABASE_URL="${1:-${DATABASE_URL:-}}"
SERVICE_ROLE_JWT="${2:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
SUPABASE_URL="${3:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
CNIC_KEY="${4:-${ZAMEEN_CNIC_KEY:-}}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is required (arg 1 or env)" >&2
  exit 1
fi
if [[ -z "$SERVICE_ROLE_JWT" ]]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY is required (arg 2 or env)" >&2
  exit 1
fi
if [[ -z "$SUPABASE_URL" ]]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL is required (arg 3 or env)" >&2
  exit 1
fi
if [[ -z "$CNIC_KEY" ]]; then
  echo "WARNING: ZAMEEN_CNIC_KEY not provided; CNIC encryption will fail until set" >&2
fi

# psql is required.
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found on PATH" >&2
  exit 1
fi

# Escape single quotes for SQL literal embedding.
escape_sql() { printf '%s' "$1" | sed "s/'/''/g"; }

SERVICE_ROLE_JWT_ESC=$(escape_sql "$SERVICE_ROLE_JWT")
SUPABASE_URL_ESC=$(escape_sql "$SUPABASE_URL")
CNIC_KEY_ESC=$(escape_sql "${CNIC_KEY:-}")

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<EOF
alter database postgres set app.service_role_jwt = '${SERVICE_ROLE_JWT_ESC}';
alter database postgres set app.supabase_url = '${SUPABASE_URL_ESC}';
alter database postgres set app.cnic_key = '${CNIC_KEY_ESC}';
EOF

echo "Runtime config injected. New sessions will see the updated GUCs."
