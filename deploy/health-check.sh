#!/usr/bin/env bash
# Hit /api/health on every Zameen subdomain. Exit non-zero on any failure.
# Suitable for an external cron, an uptime monitor, or a Hetzner check.
set -uo pipefail

HOSTS=(
  "agri.feerasta.ai"
  "field.agri.feerasta.ai"
  "ops.agri.feerasta.ai"
  "approve.agri.feerasta.ai"
)

TIMEOUT="${TIMEOUT:-8}"
FAIL=0

for host in "${HOSTS[@]}"; do
  url="https://${host}/api/health"
  body=$(curl -fsS --max-time "$TIMEOUT" "$url" || echo "")
  if [[ -z "$body" ]]; then
    echo "FAIL $host"
    FAIL=1
    continue
  fi
  ok=$(echo "$body" | jq -r '.ok' 2>/dev/null || echo "")
  if [[ "$ok" != "true" ]]; then
    echo "FAIL $host body=$body"
    FAIL=1
  else
    version=$(echo "$body" | jq -r '.version')
    echo "OK   $host version=$version"
  fi
done

exit "$FAIL"
