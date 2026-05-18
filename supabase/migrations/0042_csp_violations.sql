-- CSP violation sink. All four apps POST report-only violations to
-- /api/csp-report, which inserts into this table. Read access locked
-- to director/super_admin via RLS; inserts allowed from any session
-- so the report endpoint can work pre-auth (browsers may report on
-- the login page).
create table if not exists zameen.csp_violations (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  document_uri text,
  violated_directive text,
  blocked_uri text,
  source_file text,
  line_number int,
  column_number int,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_csp_recent on zameen.csp_violations(occurred_at desc);

alter table zameen.csp_violations enable row level security;

create policy "csp_admin" on zameen.csp_violations
  for select using (
    exists (
      select 1 from zameen.user_entity_roles
      where user_id = auth.uid()
        and role in ('director', 'super_admin')
        and is_active = true
    )
  );

create policy "csp_insert_anon" on zameen.csp_violations
  for insert with check (true);
