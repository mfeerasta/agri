-- Equipment preventive maintenance scheduling and lifecycle cost tracking.
-- Lives entirely under zameen.*; no cross-schema links.

create table if not exists zameen.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references zameen.assets(id) on delete cascade,
  name text not null,
  trigger_kind text not null check (trigger_kind in ('hour_meter','days_elapsed','km_traveled','calendar_date','condition_based')),
  trigger_value numeric(12,2),
  cron_expression text,
  task_template jsonb not null,
  parts_required jsonb not null default '[]'::jsonb,
  estimated_cost_pkr numeric(12,2),
  estimated_downtime_hours numeric(6,2),
  is_active boolean not null default true,
  last_executed_at timestamptz,
  next_due_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_maint_asset on zameen.maintenance_plans(asset_id);
create index if not exists idx_maint_due on zameen.maintenance_plans(next_due_at) where is_active = true;

create table if not exists zameen.maintenance_executions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references zameen.maintenance_plans(id) on delete set null,
  asset_id uuid not null references zameen.assets(id) on delete cascade,
  executed_on date not null,
  executed_by uuid,
  hour_meter_at_service numeric(12,2),
  parts_used jsonb not null default '[]'::jsonb,
  labor_hours numeric(6,2),
  parts_cost_pkr numeric(12,2),
  labor_cost_pkr numeric(12,2),
  external_service_cost_pkr numeric(12,2),
  total_cost_pkr numeric(14,2) not null,
  next_due_at timestamptz,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  approval_request_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_maint_exec_asset on zameen.maintenance_executions(asset_id, executed_on desc);

alter table zameen.maintenance_plans enable row level security;
alter table zameen.maintenance_executions enable row level security;

drop policy if exists mp_via_asset on zameen.maintenance_plans;
create policy mp_via_asset on zameen.maintenance_plans for all using (
  exists (
    select 1 from zameen.assets a
    where a.id = asset_id
      and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

drop policy if exists me_via_asset on zameen.maintenance_executions;
create policy me_via_asset on zameen.maintenance_executions for all using (
  exists (
    select 1 from zameen.assets a
    where a.id = asset_id
      and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

-- Extend approval_type to include preventive maintenance.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'approval_type'
      and n.nspname = 'zameen'
      and e.enumlabel = 'preventive_maintenance'
  ) then
    alter type zameen.approval_type add value 'preventive_maintenance';
  end if;
end$$;
