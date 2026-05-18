#!/usr/bin/env bash
# Pre-commit hook installed via deploy/install-hooks.sh.
# Runs the secret scanner and blocks em-dashes in staged source files.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/scan-secrets.sh"
if git diff --cached -U0 -- ':!*.md' | \rg -q '\xe2\x80\x94'; then
  echo "X Em-dash detected in staged source files"; exit 1
fi
