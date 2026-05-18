#!/usr/bin/env bash
# Defensive secret scanner. Greps the working tree for high-entropy patterns
# that commonly correspond to leaked credentials. Exits non-zero on any hit
# so it can gate pre-commit + CI.
set -uo pipefail

PATTERNS=(
  'sk-[A-Za-z0-9]{20,}'
  'sk-ant-[A-Za-z0-9-]{20,}'
  'eyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{30,}'
  'service_role.*=.*[A-Za-z0-9]{30,}'
  'AKIA[A-Z0-9]{16}'
  'AIza[A-Za-z0-9_-]{30,}'
  '-----BEGIN.*PRIVATE KEY-----'
  'whsec_[A-Za-z0-9]{20,}'
  'xoxb-[A-Za-z0-9-]{40,}'
)

FOUND=0
for p in "${PATTERNS[@]}"; do
  while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    # Allow placeholders in .env.example, docs/, and any .md file.
    if [[ "$file" == *.env.example* ]] || [[ "$file" == */docs/* ]] || [[ "$file" == *.md ]]; then continue; fi
    echo "FOUND: $line"
    FOUND=$((FOUND+1))
  done < <(\rg -n "$p" --hidden --no-ignore-vcs 2>/dev/null || true)
done

if [ $FOUND -gt 0 ]; then
  echo "X $FOUND potential secret leaks"; exit 1
fi
echo "ok no secrets detected"
