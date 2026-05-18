#!/usr/bin/env bash
# Copies deploy/pre-commit-hook.sh into the local .git/hooks directory.
# Idempotent; safe to re-run after pulling new hook revisions.
set -e
HOOK="$(git rev-parse --git-dir)/hooks/pre-commit"
cp deploy/pre-commit-hook.sh "$HOOK"
chmod +x "$HOOK"
echo "ok pre-commit hook installed at $HOOK"
