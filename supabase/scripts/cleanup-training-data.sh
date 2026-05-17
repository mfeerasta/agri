#!/usr/bin/env bash
# Purge every is_training = true row across the transactional tables.
# Scheduled weekly via pg_cron. Safe to run at any time; rows are scoped per session.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

psql "$DATABASE_URL" <<'EOF'
begin;

delete from zameen.diesel_daily_logs where is_training = true;
delete from zameen.diesel_purchases where is_training = true;
delete from zameen.repair_requests where is_training = true;
delete from zameen.harvest_records where is_training = true;
delete from zameen.attendance_records where is_training = true;
delete from zameen.task_completions where is_training = true;
delete from zameen.milk_records where is_training = true;

-- Mark stale training sessions (older than 7 days, never completed) as completed.
update zameen.training_sessions
  set completed_at = now()
  where completed_at is null
    and started_at < now() - interval '7 days';

commit;
EOF

echo "[cleanup-training-data] done at $(date -u +%FT%TZ)"
