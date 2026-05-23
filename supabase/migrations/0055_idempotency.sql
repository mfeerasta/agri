-- Production hardening: TTL cleanup for idempotency log.
-- The base table was created in migration 0008. This migration adds the
-- expires_at index and a cleanup function that the existing pg_cron
-- scheduler invokes hourly to prune expired keys.

-- Add expires_at column if missing. The handler in @zameen/shared/idempotency
-- treats ttlSeconds at lookup time, but we keep an explicit column so
-- pg_cron can prune without computing intervals.
alter table zameen.idempotency_log
  add column if not exists expires_at timestamptz;

-- Backfill expires_at to created_at + 24h for any pre-existing rows.
update zameen.idempotency_log
   set expires_at = created_at + interval '24 hours'
 where expires_at is null;

create index if not exists idx_idempotency_expires
  on zameen.idempotency_log (expires_at);

-- Cleanup function. Idempotent. Returns rows pruned.
create or replace function zameen.prune_idempotency_keys()
returns integer
language plpgsql
as $$
declare
  pruned integer;
begin
  delete from zameen.idempotency_log
   where expires_at is not null and expires_at < now();
  get diagnostics pruned = row_count;
  return pruned;
end;
$$;

-- Schedule the prune via pg_cron if the extension is available.
-- Hourly at minute 7 to spread load away from other crons on the hour.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('zameen-prune-idempotency')
      where exists (
        select 1 from cron.job where jobname = 'zameen-prune-idempotency'
      );
    perform cron.schedule(
      'zameen-prune-idempotency',
      '7 * * * *',
      $cron$ select zameen.prune_idempotency_keys(); $cron$
    );
  end if;
end $$;
