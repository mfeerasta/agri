#!/usr/bin/env bash
# Disaster-recovery drill. Pulls the latest backup from R2, restores into an
# ephemeral Postgres (Docker by default; can target a Hetzner CX11 with
# DR_TARGET=hetzner), runs deploy/smoke-test.sql, reports to Slack, records
# to zameen.dr_drill_runs, then destroys the ephemeral instance.
#
# Idempotent: pick the latest backup by date prefix and overwrite local state.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zameen}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

: "${CLOUDFLARE_R2_ACCOUNT_ID:?}"
: "${CLOUDFLARE_R2_ACCESS_KEY:?}"
: "${CLOUDFLARE_R2_SECRET_KEY:?}"
BACKUP_BUCKET="${CLOUDFLARE_R2_BACKUP_BUCKET:-zameen-backups}"
DR_TARGET="${DR_TARGET:-docker}"
SLACK_WEBHOOK="${DEPLOY_SLACK_WEBHOOK:-}"
DRILL_ID="dr-$(date -u +%Y%m%dT%H%M%SZ)"

START_EPOCH=$(date +%s)
WORK_DIR="$(mktemp -d -t zameen-drill-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

slack() {
  local text="$1"
  if [[ -n "$SLACK_WEBHOOK" ]]; then
    curl -sS -X POST -H 'content-type: application/json' \
      --data "$(jq -nc --arg t "$text" '{text:$t}')" \
      "$SLACK_WEBHOOK" >/dev/null || true
  fi
  echo "[$(date -u +%FT%TZ)] $text"
}

export AWS_ACCESS_KEY_ID="$CLOUDFLARE_R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$CLOUDFLARE_R2_SECRET_KEY"
R2_ENDPOINT="https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

slack ":satellite: $DRILL_ID starting (target=$DR_TARGET)"

# 1. Find the most recent backup
LATEST_KEY=$(aws s3 ls "s3://$BACKUP_BUCKET/" --endpoint-url "$R2_ENDPOINT" \
  | awk '{print $NF}' | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}/$' | sort | tail -n1)
LATEST_DATE="${LATEST_KEY%/}"
if [[ -z "$LATEST_DATE" ]]; then
  slack ":x: $DRILL_ID no backups found in s3://$BACKUP_BUCKET/"
  exit 1
fi
DUMP_FILE="$WORK_DIR/zameen-$LATEST_DATE.dump"
MANIFEST_FILE="$WORK_DIR/zameen-$LATEST_DATE.manifest.json"

slack ":inbox_tray: $DRILL_ID downloading $LATEST_DATE"
aws s3 cp "s3://$BACKUP_BUCKET/$LATEST_DATE/zameen-$LATEST_DATE.dump"          "$DUMP_FILE"     --endpoint-url "$R2_ENDPOINT"
aws s3 cp "s3://$BACKUP_BUCKET/$LATEST_DATE/zameen-$LATEST_DATE.manifest.json" "$MANIFEST_FILE" --endpoint-url "$R2_ENDPOINT"

BACKUP_SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $(stat -c%s "$DUMP_FILE" 2>/dev/null || stat -f%z "$DUMP_FILE") / 1048576}")

# 2. Manifest sanity (row counts > 0 for critical tables)
MANIFEST_OK=1
for tbl in entities users fields; do
  cnt=$(jq -r --arg t "$tbl" '.rowCounts[$t] // 0' "$MANIFEST_FILE")
  if [[ "$cnt" -le 0 ]]; then
    slack ":warning: $DRILL_ID manifest row count for $tbl is $cnt"
    MANIFEST_OK=0
  fi
done

# 3. Stand up the restore target
CONTAINER_NAME="zameen-drill-$$"
if [[ "$DR_TARGET" == "docker" ]]; then
  slack ":whale: $DRILL_ID booting ephemeral postgres"
  docker run -d --rm --name "$CONTAINER_NAME" \
    -e POSTGRES_PASSWORD=drill \
    -p 0:5432 postgres:16-alpine >/dev/null
  for _ in $(seq 1 30); do
    if docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    sleep 1
  done
  PG_PORT=$(docker inspect -f '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$CONTAINER_NAME")
  RESTORE_URL="postgresql://postgres:drill@127.0.0.1:${PG_PORT}/postgres"
elif [[ "$DR_TARGET" == "local" ]]; then
  RESTORE_URL="${DR_RESTORE_URL:?DR_RESTORE_URL required for local target}"
else
  slack ":x: $DRILL_ID unsupported target $DR_TARGET"
  exit 2
fi

cleanup() {
  if [[ "$DR_TARGET" == "docker" ]] && docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap 'cleanup; rm -rf "$WORK_DIR"' EXIT

# 4. Restore
slack ":arrow_forward: $DRILL_ID restoring dump"
pg_restore --no-owner --no-privileges --schema=zameen --clean --if-exists \
  --dbname="$RESTORE_URL" "$DUMP_FILE" 2>&1 | tail -n 5 || true

# 5. Smoke tests
SMOKE_OUT="$WORK_DIR/smoke.log"
slack ":mag: $DRILL_ID running smoke tests"
set +e
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/smoke-test.sql" >"$SMOKE_OUT" 2>&1
SMOKE_RC=$?
set -e

FAILS=$(grep -c '^NOTICE:  FAIL:' "$SMOKE_OUT" || true)
PASSES=$(grep -c '^NOTICE:  PASS:' "$SMOKE_OUT" || true)
DURATION=$(( $(date +%s) - START_EPOCH ))

if [[ "$SMOKE_RC" -eq 0 && "$FAILS" -eq 0 && "$MANIFEST_OK" -eq 1 ]]; then
  RESULT_EMOJI=":white_check_mark:"
  RESULT_BOOL=true
else
  RESULT_EMOJI=":x:"
  RESULT_BOOL=false
fi

FAIL_JSON=$(grep '^NOTICE:  FAIL:' "$SMOKE_OUT" | jq -Rsc 'split("\n")|map(select(length>0))')

slack "$RESULT_EMOJI $DRILL_ID restored=$RESULT_BOOL passes=$PASSES fails=$FAILS duration=${DURATION}s backup=$LATEST_DATE size=${BACKUP_SIZE_MB}MB"

# 6. Record into zameen.dr_drill_runs if we have DATABASE_URL pointing at prod
if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=0 <<SQL
insert into zameen.dr_drill_runs (
  backup_filename, backup_size_mb, restored, smoke_tests_passed,
  smoke_test_failures, duration_seconds, notes
) values (
  'zameen-$LATEST_DATE.dump',
  $BACKUP_SIZE_MB,
  $RESULT_BOOL,
  $RESULT_BOOL,
  '$FAIL_JSON'::jsonb,
  $DURATION,
  '$DRILL_ID'
);
SQL
fi

if [[ "$RESULT_BOOL" != "true" ]]; then
  exit 3
fi
