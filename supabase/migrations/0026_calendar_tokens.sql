-- Calendar subscription tokens for live iCal feeds.
create table if not exists zameen.calendar_subscription_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zameen.users(id) on delete cascade,
  token text not null unique,
  scope text not null check (scope in ('tasks','crop_plans','approvals','feasibilities','all')),
  filter jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_cal_token on zameen.calendar_subscription_tokens(token);
create index if not exists idx_cal_token_user on zameen.calendar_subscription_tokens(user_id);

alter table zameen.calendar_subscription_tokens enable row level security;

drop policy if exists "cal_tokens_self" on zameen.calendar_subscription_tokens;
create policy "cal_tokens_self" on zameen.calendar_subscription_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
