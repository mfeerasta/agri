-- Pre-season what-if planner. Separate from feasibility_studies (Director approval narrative).
-- These tables back the planner UI under /app/crops/feasibility.

create table if not exists zameen.feasibility_plans (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  season text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feasibility_plans_entity_idx
  on zameen.feasibility_plans (entity_id, created_at desc);

create table if not exists zameen.feasibility_plan_scenarios (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references zameen.feasibility_plans(id) on delete cascade,
  name text not null,
  crop_code text not null,
  field_ids uuid[] not null default '{}',
  total_acres numeric(12,4) not null,
  yield_per_acre_kg numeric(14,2) not null,
  price_per_kg_pkr numeric(14,2) not null,
  cost_breakdown jsonb not null default '{}'::jsonb,
  revenue_pkr numeric(14,2) not null,
  total_cost_pkr numeric(14,2) not null,
  net_pkr numeric(14,2) not null,
  net_per_acre_pkr numeric(14,2) not null,
  irr_pct numeric(6,3),
  payback_months numeric(6,2),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists feasibility_plan_scenarios_plan_idx
  on zameen.feasibility_plan_scenarios (plan_id, created_at);

alter table zameen.feasibility_plans enable row level security;
alter table zameen.feasibility_plan_scenarios enable row level security;

drop policy if exists fp_entity on zameen.feasibility_plans;
create policy fp_entity on zameen.feasibility_plans
  for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

drop policy if exists fps_via_plan on zameen.feasibility_plan_scenarios;
create policy fps_via_plan on zameen.feasibility_plan_scenarios
  for all
  using (plan_id in (select id from zameen.feasibility_plans));

-- Pre-fill assistance: recommended yield + default cost breakdown per crop.
alter table zameen.crop_profiles
  add column if not exists recommended_yield_kg_per_acre numeric(10,2);

alter table zameen.crop_profiles
  add column if not exists default_cost_breakdown jsonb not null default '{}'::jsonb;
