-- Multi-device session tracking. One row per active sign-in across
-- web/field/ops/approve/mobile. Session token is stored hashed (sha256)
-- so the table is safe at rest. Revocation flips revoked_at and the
-- caller invalidates the Supabase session via the admin API.

create table if not exists zameen.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zameen.users(id) on delete cascade,
  session_token_hash text not null,
  device_label text,
  user_agent text,
  ip_address text,
  app text not null check (app in ('web','field','ops','approve','mobile-field','mobile-ops')),
  city text,
  country text,
  signed_in_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx-sessions-user
  on zameen.user_sessions(user_id, signed_in_at desc);
create index if not exists idx-sessions-token
  on zameen.user_sessions(session_token_hash)
  where revoked_at is null;

alter table zameen.user_sessions enable row level security;

drop policy if exists "sessions-self" on zameen.user_sessions;
create policy "sessions-self" on zameen.user_sessions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
