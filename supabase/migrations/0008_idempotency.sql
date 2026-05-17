-- Idempotency log for server actions and edge functions. Server-side mutations
-- that must be safe under client retry write (key, user, hash, response) here
-- once and short-circuit on subsequent matching keys.

create table if not exists zameen.idempotency_log (
  idempotency_key text primary key,
  user_id uuid,
  request_hash text,
  response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_idempotency_user
  on zameen.idempotency_log (user_id, created_at desc);
