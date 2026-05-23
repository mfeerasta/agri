-- Sustainability: carbon credits, ESG reporting, regenerative practices tracking.
-- Pakistan Paris-Agreement context. Tracks practices, periodic carbon assessments,
-- issued/sold carbon credits, and quarterly ESG snapshots.

create table if not exists zameen.sustainability_practices (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  field_id uuid references zameen.fields(id),
  practice_kind text not null check (practice_kind in (
    'no_till','reduced_till','cover_cropping','crop_rotation','organic_amendments',
    'biochar_application','agroforestry','contour_farming','drip_irrigation','mulching',
    'integrated_pest_management','reduced_synthetic_fertilizer','manure_management',
    'rice_alternate_wetting_drying','enteric_methane_reducer','renewable_energy',
    'water_harvesting','windbreak_planting','rotational_grazing','other'
  )),
  started_on date not null,
  ended_on date,
  area_acres numeric(10,3),
  baseline_metric jsonb,
  current_metric jsonb,
  evidence_urls jsonb not null default '[]'::jsonb,
  verifier text,
  verification_date date,
  certification text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_sp_entity on zameen.sustainability_practices(entity_id);
create index if not exists idx_sp_field on zameen.sustainability_practices(field_id);

create table if not exists zameen.carbon_assessments (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  field_id uuid references zameen.fields(id),
  assessment_date date not null,
  scope_co2e_tons jsonb not null,
  total_emissions_co2e_tons numeric(12,3) not null,
  total_sequestration_co2e_tons numeric(12,3) not null,
  net_co2e_tons numeric(12,3) not null,
  baseline_year int,
  reduction_vs_baseline_pct numeric(5,2),
  methodology text,
  verified_by text,
  certificate_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ca_entity_date on zameen.carbon_assessments(entity_id, assessment_date desc);

create table if not exists zameen.carbon_credits (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  credit_number text,
  issued_by text,
  standard text check (standard in ('verra_vcs','gold_standard','climate_action_reserve','plan_vivo','clean_development_mechanism','custom_voluntary')),
  issued_on date,
  vintage_year int not null,
  quantity_tco2e numeric(14,3) not null,
  status text not null default 'issued' check (status in ('issued','retired','transferred','sold','pending')),
  sold_to text,
  sold_on date,
  sold_price_per_ton_pkr numeric(12,2),
  total_revenue_pkr numeric(14,2),
  retirement_reason text,
  related_practice_ids uuid[],
  related_assessment_id uuid references zameen.carbon_assessments(id),
  certificate_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_cc_entity_status on zameen.carbon_credits(entity_id, status);
create index if not exists idx_cc_vintage on zameen.carbon_credits(entity_id, vintage_year);

create table if not exists zameen.esg_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  snapshot_date date not null,
  period_start date not null,
  period_end date not null,
  environmental jsonb not null,
  social jsonb not null,
  governance jsonb not null,
  framework text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_esg_entity_date on zameen.esg_metrics_snapshots(entity_id, snapshot_date desc);

alter table zameen.sustainability_practices enable row level security;
alter table zameen.carbon_assessments enable row level security;
alter table zameen.carbon_credits enable row level security;
alter table zameen.esg_metrics_snapshots enable row level security;

create policy sp_entity on zameen.sustainability_practices for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy ca_entity on zameen.carbon_assessments for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy cc_entity on zameen.carbon_credits for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy esg_entity on zameen.esg_metrics_snapshots for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

-- Add carbon_credit_sale approval type
do $$ begin
  alter type zameen.approval_type add value if not exists 'carbon_credit_sale';
exception when duplicate_object then null; end $$;

-- Quarterly auto-assessment: 06:00 PKT on day 1 of Jan/Apr/Jul/Oct.
select cron.schedule(
  'zameen-carbon-assessment-quarterly',
  '0 1 1 1,4,7,10 *',
  $$ select zameen.invoke_edge_function('carbon-assessment-quarterly'); $$
);
