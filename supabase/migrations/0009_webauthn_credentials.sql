-- WebAuthn passkey credentials and challenges for the Approver PWA.

create table if not exists zameen.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[],
  device_label text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_webauthn_user on zameen.webauthn_credentials(user_id);

create table if not exists zameen.webauthn_challenges (
  challenge text primary key,
  user_id uuid,
  kind text not null check (kind in ('registration','authentication')),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);
create index if not exists idx_webauthn_chall_exp on zameen.webauthn_challenges(expires_at);

alter table zameen.webauthn_credentials enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'zameen'
      and tablename = 'webauthn_credentials'
      and policyname = 'webauthn_self'
  ) then
    create policy "webauthn_self" on zameen.webauthn_credentials
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end$$;
