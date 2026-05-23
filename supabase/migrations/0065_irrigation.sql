-- Irrigation module: Warabandi rotational slots, planned schedules, executed events.
-- Schema-isolated under zameen.*. Tubewell events optionally link diesel logs and emit cost allocations.

-- Warabandi slots: weekly rotation windows per water source
create table if not exists zameen.warabandi_slots (
  id uuid primary key default gen_random_uuid(),
  water_source_id uuid not null references zameen.water_sources(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  duration_minutes int generated always as ((extract(epoch from (end_time - start_time))/60)::int) stored,
  rotation_weeks int not null default 1,
  notes text,
  is_active boolean not null default true
);
create index if not exists idx_wara_source on zameen.warabandi_slots(water_source_id);
create index if not exists idx_wara_day on zameen.warabandi_slots(day_of_week) where is_active;

-- Irrigation events: an actual irrigation that took place
create table if not exists zameen.irrigation_events (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  water_source_id uuid not null references zameen.water_sources(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  estimated_volume_m3 numeric(12,2),
  estimated_depth_mm numeric(6,2),
  diesel_used_liters numeric(8,2),
  diesel_log_id uuid,
  method text check (method in ('flood','furrow','sprinkler','drip','basin')),
  operator_id uuid,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  cost_pkr numeric(14,2),
  created_at timestamptz not null default now()
);
create index if not exists idx_irr_field_date on zameen.irrigation_events(field_id, started_at desc);
create index if not exists idx_irr_source_date on zameen.irrigation_events(water_source_id, started_at desc);

-- Planned irrigation schedules (auto-created by scheduler or manually dropped onto Warabandi slots)
create table if not exists zameen.irrigation_schedules (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  crop_plan_id uuid,
  scheduled_for timestamptz not null,
  warabandi_slot_id uuid references zameen.warabandi_slots(id) on delete set null,
  water_source_id uuid references zameen.water_sources(id),
  expected_duration_minutes int,
  status text not null default 'planned' check (status in ('planned','completed','skipped','missed')),
  completed_event_id uuid references zameen.irrigation_events(id),
  reason_if_skipped text,
  created_by_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_irr_sched_field on zameen.irrigation_schedules(field_id, scheduled_for);
create index if not exists idx_irr_sched_status on zameen.irrigation_schedules(status, scheduled_for);

alter table zameen.warabandi_slots enable row level security;
alter table zameen.irrigation_events enable row level security;
alter table zameen.irrigation_schedules enable row level security;

create policy ws_via_source on zameen.warabandi_slots for all using (
  exists (
    select 1 from zameen.water_sources w
    join zameen.farms f on f.id = w.farm_id
    where w.id = water_source_id
      and f.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

create policy ie_via_field on zameen.irrigation_events for all using (
  exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id
      and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

create policy is_via_field on zameen.irrigation_schedules for all using (
  exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id
      and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);
