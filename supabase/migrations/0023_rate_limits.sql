-- 0023_rate_limits.sql
-- Cross-process rate limit buckets. Used by packages/shared/src/rate-limit.ts.

create table if not exists zameen.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  expires_at timestamptz not null,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limit_buckets_expires_idx
  on zameen.rate_limit_buckets (expires_at);

-- Periodic cleanup: callers can run this whenever convenient.
create or replace function zameen.purge_expired_rate_limits() returns integer
language sql as $$
  with deleted as (
    delete from zameen.rate_limit_buckets
    where expires_at < now() - interval '1 hour'
    returning 1
  )
  select count(*)::int from deleted;
$$;

-- Lockdown: only service role can touch rate limit buckets.
alter table zameen.rate_limit_buckets enable row level security;
drop policy if exists rate_limit_service_only on zameen.rate_limit_buckets;
create policy rate_limit_service_only on zameen.rate_limit_buckets
  for all using (false) with check (false);
