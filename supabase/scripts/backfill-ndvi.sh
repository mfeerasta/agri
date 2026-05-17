#!/usr/bin/env bash
# Backfill NDVI observations by invoking the ndvi-puller edge function
# repeatedly. The puller looks back 7 days each call; we walk back 90 days
# at a 5-day stride (Sentinel-2 revisit) so one pilot tenant gets immediate
# history on day 1.
#
# Idempotent: the puller short-circuits when an obs already exists for the
# chosen acquisition date.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

SUPABASE_URL="${SUPABASE_URL:-}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [[ -z "$SUPABASE_URL" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl not found on PATH" >&2
  exit 1
fi

ENDPOINT="${SUPABASE_URL%/}/functions/v1/ndvi-puller"
STRIDE_DAYS="${NDVI_BACKFILL_STRIDE:-5}"
TOTAL_DAYS="${NDVI_BACKFILL_DAYS:-90}"

echo "Backfilling NDVI: ${TOTAL_DAYS} days, stride ${STRIDE_DAYS}d, target ${ENDPOINT}"

invocations=$(( TOTAL_DAYS / STRIDE_DAYS ))
for i in $(seq 0 "$invocations"); do
  echo "--- pass $((i + 1))/$((invocations + 1)) ---"
  curl --fail --silent --show-error \
    -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "content-type: application/json" \
    -d '{}'
  echo ""
  # Brief pause to be polite to Sentinel Hub's free-tier quota.
  sleep 3
done

echo ""
echo "NDVI backfill complete. Inspect zameen.ndvi_observations for results."
