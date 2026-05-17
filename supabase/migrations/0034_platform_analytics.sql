-- Self-hosted product analytics. Fire-and-forget inserts from the app track
-- page views, feature usage, approvals, AI calls. Director and super_admin can read.

create table if not exists zameen.platform_events (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id) on delete set null,
  user_id uuid references zameen.users(id) on delete set null,
  event_name text not null,
  event_props jsonb not null default '{}'::jsonb,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_events_occurred on zameen.platform_events(occurred_at desc);
create index if not exists idx_events_name on zameen.platform_events(event_name, occurred_at desc);
create index if not exists idx_events_user_day on zameen.platform_events(user_id, date_trunc('day', occurred_at));
create index if not exists idx_events_entity_day on zameen.platform_events(entity_id, date_trunc('day', occurred_at));

alter table zameen.platform_events enable row level security;

drop policy if exists "events_insert" on zameen.platform_events;
create policy "events_insert" on zameen.platform_events
  for insert
  with check (auth.role() in ('authenticated', 'service_role'));

drop policy if exists "events_select_admin" on zameen.platform_events;
create policy "events_select_admin" on zameen.platform_events
  for select
  using (
    exists (
      select 1 from zameen.user_entity_roles
      where user_id = auth.uid()
        and role in ('director', 'super_admin')
        and is_active = true
    )
  );
