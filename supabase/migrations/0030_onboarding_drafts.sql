-- Onboarding drafts: persistent wizard state so MF can resume a multi-step
-- new-farm setup across sessions.

create table if not exists zameen.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references zameen.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  step int not null default 1,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_onboarding_drafts_creator
  on zameen.onboarding_drafts (created_by, finalized_at);

alter table zameen.onboarding_drafts enable row level security;

drop policy if exists "onboarding_drafts_owner" on zameen.onboarding_drafts;
create policy "onboarding_drafts_owner"
  on zameen.onboarding_drafts
  for all
  using (
    created_by in (
      select id from zameen.users where auth_user_id = auth.uid()
    )
  )
  with check (
    created_by in (
      select id from zameen.users where auth_user_id = auth.uid()
    )
  );
