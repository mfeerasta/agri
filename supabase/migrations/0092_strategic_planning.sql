-- Strategic planning: 5-year roadmap, crop rotation, capex initiatives, scenario simulations.
-- Director-level long-horizon planning. No links to Sentinel or Haazri.

do $$
begin
  alter type zameen.approval_type add value if not exists 'strategic_initiative';
exception when others then null;
end$$;

create table if not exists zameen.strategic_plans (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  horizon_years int not null default 5,
  start_year int not null,
  created_by uuid not null,
  vision_statement text,
  current_state_snapshot jsonb,
  target_state_snapshot jsonb,
  status text not null default 'draft' check (status in ('draft','active','superseded','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sp_entity on zameen.strategic_plans(entity_id, status);

create table if not exists zameen.strategic_initiatives (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references zameen.strategic_plans(id) on delete cascade,
  name text not null,
  category text not null check (category in ('crop_rotation','capex','expansion','diversification','technology','sustainability','market_development','workforce','financial','other')),
  start_year int not null,
  end_year int not null,
  estimated_investment_pkr numeric(14,2),
  expected_return_pkr numeric(14,2),
  expected_irr_pct numeric(6,3),
  payback_years numeric(5,2),
  priority text not null check (priority in ('low','medium','high','critical')),
  risk_factors jsonb,
  dependencies uuid[],
  status text not null default 'proposed' check (status in ('proposed','approved','in_progress','completed','deferred','cancelled')),
  approval_request_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_si_plan on zameen.strategic_initiatives(plan_id, status);

create table if not exists zameen.crop_rotation_plans (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references zameen.strategic_plans(id) on delete cascade,
  field_id uuid not null references zameen.fields(id),
  rotation_schedule jsonb not null,
  rotation_kind text check (rotation_kind in ('two_year','three_year','four_year','custom')),
  rotation_principles text[],
  expected_soil_impact text,
  created_at timestamptz not null default now()
);
create index if not exists idx_crp_plan_field on zameen.crop_rotation_plans(plan_id, field_id);

create table if not exists zameen.scenario_simulations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references zameen.strategic_plans(id) on delete cascade,
  scenario_name text not null,
  base_year int not null,
  horizon_years int not null,
  inputs_jsonb jsonb not null,
  outputs_jsonb jsonb not null,
  net_present_value_pkr numeric(14,2),
  internal_rate_of_return_pct numeric(6,3),
  payback_years numeric(5,2),
  monte_carlo_iterations int,
  monte_carlo_results jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_plan on zameen.scenario_simulations(plan_id, created_at desc);

alter table zameen.strategic_plans enable row level security;
alter table zameen.strategic_initiatives enable row level security;
alter table zameen.crop_rotation_plans enable row level security;
alter table zameen.scenario_simulations enable row level security;
create policy sp_entity on zameen.strategic_plans for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy si_via_plan on zameen.strategic_initiatives for all using (exists (select 1 from zameen.strategic_plans p where p.id = plan_id and p.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy crp_via_plan on zameen.crop_rotation_plans for all using (exists (select 1 from zameen.strategic_plans p where p.id = plan_id and p.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy ss_via_plan on zameen.scenario_simulations for all using (plan_id is null or exists (select 1 from zameen.strategic_plans p where p.id = plan_id and p.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
