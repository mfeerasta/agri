-- 0015_automations.sql
-- monday.com-style automation recipes + user dashboards.

create table if not exists zameen.automation_recipes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id) on delete cascade,
  name text not null,
  description text,
  trigger_kind text not null check (trigger_kind in (
    'task_status_change',
    'task_due_soon',
    'task_overdue',
    'task_created',
    'crop_stage_advance',
    'approval_submitted',
    'approval_decided',
    'diesel_anomaly',
    'inventory_low',
    'date_arrives',
    'comment_added',
    'mention_received'
  )),
  trigger_config jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_by uuid references zameen.users(id),
  last_fired_at timestamptz,
  fire_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_automations_entity on zameen.automation_recipes(entity_id, enabled);
create index if not exists idx_automations_trigger on zameen.automation_recipes(trigger_kind, enabled);

create table if not exists zameen.automation_runs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references zameen.automation_recipes(id) on delete cascade,
  triggered_by jsonb,
  actions_executed jsonb not null default '[]'::jsonb,
  status text not null check (status in ('success','partial','failed')),
  error_message text,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_runs_recipe on zameen.automation_runs(recipe_id, occurred_at desc);

alter table zameen.automation_recipes enable row level security;
create policy "recipes_entity" on zameen.automation_recipes for all using (
  entity_id is null or entity_id in (select zameen.accessible_entity_ids(auth.uid()))
) with check (
  entity_id is null or entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);

alter table zameen.automation_runs enable row level security;
create policy "runs_via_recipe" on zameen.automation_runs for select using (
  exists (
    select 1 from zameen.automation_recipes r
    where r.id = recipe_id
      and (r.entity_id is null or r.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  )
);

-- User-customisable dashboards.
create table if not exists zameen.user_dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zameen.users(id) on delete cascade,
  entity_id uuid references zameen.entities(id) on delete cascade,
  name text not null,
  widgets jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_dashboards_user on zameen.user_dashboards(user_id, is_default);
alter table zameen.user_dashboards enable row level security;
create policy "dashboards_self" on zameen.user_dashboards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
