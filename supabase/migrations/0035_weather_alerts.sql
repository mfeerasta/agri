-- Weather alert rules and fired alerts. The weather-alert-checker edge function
-- evaluates rules against zameen.weather_records and inserts a row into
-- zameen.weather_alerts on a match, optionally auto-creating a task.

create table if not exists zameen.weather_alert_rules (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  condition_kind text not null check (condition_kind in (
    'frost_warning','heatwave','heavy_rain','strong_wind','low_humidity','drought_days'
  )),
  threshold jsonb not null,
  action_kind text not null check (action_kind in (
    'create_task','notify_supervisor','flag_field','suspend_spraying'
  )),
  action_config jsonb not null default '{}'::jsonb,
  last_fired_at timestamptz,
  fire_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_wx_rules_entity on zameen.weather_alert_rules(entity_id, enabled);

alter table zameen.weather_alert_rules enable row level security;

drop policy if exists "wx_rules_entity" on zameen.weather_alert_rules;
create policy "wx_rules_entity" on zameen.weather_alert_rules for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  with check (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

create table if not exists zameen.weather_alerts (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references zameen.weather_alert_rules(id) on delete cascade,
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  triggered_on date not null,
  observation jsonb not null,
  task_id uuid references zameen.tasks(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_wx_alerts_entity_date on zameen.weather_alerts(entity_id, triggered_on desc);

alter table zameen.weather_alerts enable row level security;

drop policy if exists "wx_alerts_entity" on zameen.weather_alerts;
create policy "wx_alerts_entity" on zameen.weather_alerts for select
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
