#!/usr/bin/env bash
# Assert no JS chunk in a Next.js build is larger than the configured budget.
# Usage: deploy/check-bundle-size.sh <path-to-.next>
#
# Defaults: 500 KB per chunk (BUDGET_KB env var overrides). Exits non-zero on
# violation so it can wedge a CI job.

set -euo pipefail

NEXT_DIR="${1:-apps/web/.next}"
BUDGET_KB="${BUDGET_KB:-500}"
BUDGET_BYTES=$((BUDGET_KB * 1024))

if [[ ! -d "$NEXT_DIR/static" ]]; then
  echo "[bundle-size] no build output at $NEXT_DIR/static — skipping"
  exit 0
fi

violations=0
while IFS= read -r -d '' file; do
  size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  if (( size > BUDGET_BYTES )); then
    kb=$((size / 1024))
    echo "::error::Chunk over budget: $file is ${kb}KB (budget ${BUDGET_KB}KB)"
    violations=$((violations + 1))
  fi
done < <(find "$NEXT_DIR/static" -name '*.js' -print0)

if (( violations > 0 )); then
  echo "[bundle-size] $violations chunk(s) exceeded the ${BUDGET_KB}KB budget"
  exit 1
fi

echo "[bundle-size] all chunks within ${BUDGET_KB}KB budget"
