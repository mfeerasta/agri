-- Demo request leads captured from the public marketing site.
-- Inserts are made by the service role from a server action.
-- RLS allows admins to read; nothing else can read or modify.

create table if not exists zameen.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text,
  phone text,
  message text,
  source text,
  ip_address text,
  user_agent text,
  status text not null check (status in ('new','contacted','demoed','converted','closed')) default 'new',
  created_at timestamptz not null default now()
);

create index if not exists demo_requests_created_at_idx
  on zameen.demo_requests (created_at desc);
create index if not exists demo_requests_status_idx
  on zameen.demo_requests (status);

alter table zameen.demo_requests enable row level security;

drop policy if exists demo_requests_admin_select on zameen.demo_requests;
create policy demo_requests_admin_select
  on zameen.demo_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from zameen.users u
      where u.id = auth.uid()
        and u.role in ('director','super_admin')
    )
  );

-- No public insert policy. Inserts happen via service role from the
-- demo-request API route, which performs rate limiting and validation.
