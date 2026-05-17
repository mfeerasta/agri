#!/usr/bin/env bash
# Daily logical pg_dump of the zameen schema, pushed to Cloudflare R2.
# Idempotent: re-running on the same day overwrites the day's dump.
# Reads credentials from /opt/zameen/.env.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/zameen}"
ENV_FILE="$REPO_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${CLOUDFLARE_R2_ACCOUNT_ID:?}"
: "${CLOUDFLARE_R2_ACCESS_KEY:?}"
: "${CLOUDFLARE_R2_SECRET_KEY:?}"
BACKUP_BUCKET="${CLOUDFLARE_R2_BACKUP_BUCKET:-zameen-backups}"

DATE="$(date -u +%Y-%m-%d)"
TMP_DIR="$(mktemp -d -t zameen-backup-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

DUMP_FILE="$TMP_DIR/zameen-$DATE.dump"
MANIFEST_FILE="$TMP_DIR/zameen-$DATE.manifest.json"

echo "[$(date -u +%FT%TZ)] dumping zameen schema"
pg_dump \
  --format=custom \
  --schema=zameen \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE" \
  "$DATABASE_URL"

SIZE_BYTES=$(stat -c%s "$DUMP_FILE")
SHA256=$(sha256sum "$DUMP_FILE" | awk '{print $1}')

echo "[$(date -u +%FT%TZ)] sampling row counts"
ROW_COUNTS=$(psql "$DATABASE_URL" -At -F'|' <<'SQL'
SELECT table_name || ':' || (xpath('/row/c/text()',
  query_to_xml(format('SELECT count(*) AS c FROM zameen.%I', table_name), true, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'zameen'
ORDER BY table_name
LIMIT 200;
SQL
)

cat >"$MANIFEST_FILE" <<EOF
{
  "date": "$DATE",
  "sizeBytes": $SIZE_BYTES,
  "sha256": "$SHA256",
  "rowCounts": $(echo "$ROW_COUNTS" | jq -Rsc 'split("\n") | map(select(length>0)) | map(split(":") | {(.[0]): (.[1] | tonumber)}) | add')
}
EOF

export AWS_ACCESS_KEY_ID="$CLOUDFLARE_R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$CLOUDFLARE_R2_SECRET_KEY"
R2_ENDPOINT="https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "[$(date -u +%FT%TZ)] uploading to s3://$BACKUP_BUCKET/$DATE/"
aws s3 cp "$DUMP_FILE"     "s3://$BACKUP_BUCKET/$DATE/zameen-$DATE.dump"          --endpoint-url "$R2_ENDPOINT"
aws s3 cp "$MANIFEST_FILE" "s3://$BACKUP_BUCKET/$DATE/zameen-$DATE.manifest.json" --endpoint-url "$R2_ENDPOINT"

echo "[$(date -u +%FT%TZ)] done. size=$SIZE_BYTES sha256=$SHA256"
