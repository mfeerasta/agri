-- Training mode for new workers learning the field PWA without polluting real data.
-- Adds a training_sessions table plus is_training boolean on every transactional table
-- that field workers can write to. A weekly cleanup job purges is_training = true rows.

create table if not exists zameen.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zameen.users(id) on delete cascade,
  entity_id uuid not null references zameen.entities(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  steps_completed jsonb not null default '[]'::jsonb,
  score int not null default 0
);

create index if not exists idx_training_sessions_user on zameen.training_sessions(user_id, started_at desc);

alter table zameen.training_sessions enable row level security;

drop policy if exists "training_self" on zameen.training_sessions;
create policy "training_self" on zameen.training_sessions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Tag every transactional record with is_training so cleanup is mechanical.
alter table zameen.diesel_daily_logs add column if not exists is_training boolean not null default false;
alter table zameen.diesel_purchases add column if not exists is_training boolean not null default false;
alter table zameen.repair_requests add column if not exists is_training boolean not null default false;
alter table zameen.harvest_records add column if not exists is_training boolean not null default false;
alter table zameen.attendance_records add column if not exists is_training boolean not null default false;
alter table zameen.task_completions add column if not exists is_training boolean not null default false;
alter table zameen.milk_records add column if not exists is_training boolean not null default false;

create index if not exists idx_diesel_logs_training on zameen.diesel_daily_logs(is_training) where is_training = true;
create index if not exists idx_diesel_purchases_training on zameen.diesel_purchases(is_training) where is_training = true;
create index if not exists idx_repair_requests_training on zameen.repair_requests(is_training) where is_training = true;
create index if not exists idx_harvest_records_training on zameen.harvest_records(is_training) where is_training = true;
create index if not exists idx_attendance_records_training on zameen.attendance_records(is_training) where is_training = true;
create index if not exists idx_task_completions_training on zameen.task_completions(is_training) where is_training = true;
create index if not exists idx_milk_records_training on zameen.milk_records(is_training) where is_training = true;
