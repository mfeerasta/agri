-- 0058_slow_queries.sql
-- Captures queries exceeding the configured slow-query threshold (default
-- 250ms) for surfacing on /admin/status. SQL text is sanitized at write
-- time by the tracker; we still keep RLS off because admins read this.

create table if not exists zameen.slow_queries (
  id uuid primary key default gen_random_uuid(),
  sql_text text not null,
  duration_ms int not null,
  caller text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_slow_queries_recent
  on zameen.slow_queries(occurred_at desc);
