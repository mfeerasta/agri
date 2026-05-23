-- Stakeholder reporting: investors, lenders, grants, government, offtake buyers.
-- Tracks reporting cadence, generates per-stakeholder reports, KPI catalog + actuals.
-- No links to Sentinel or Haazri.

create table if not exists zameen.stakeholders (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  stakeholder_kind text not null check (stakeholder_kind in (
    'lender_bank','lender_microfinance','grant_provider','impact_investor',
    'government','offtake_buyer','certification_body','partner_ngo','other'
  )),
  contact_person text,
  email text,
  phone text,
  address text,
  exposure_pkr numeric(14,2),
  reporting_frequency text not null check (reporting_frequency in (
    'weekly','monthly','quarterly','semi_annual','annual','event_based','on_demand'
  )),
  next_report_due date,
  reporting_requirements jsonb,
  signed_agreement_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_stakeholders_entity on zameen.stakeholders(entity_id, is_active);
create index if not exists idx_stakeholders_due on zameen.stakeholders(next_report_due) where is_active = true;

create table if not exists zameen.stakeholder_reports (
  id uuid primary key default gen_random_uuid(),
  stakeholder_id uuid not null references zameen.stakeholders(id) on delete cascade,
  report_period_start date not null,
  report_period_end date not null,
  due_date date not null,
  submitted_on date,
  status text not null default 'draft' check (status in (
    'draft','review','approved','submitted','acknowledged','overdue'
  )),
  pdf_url text,
  data_snapshot jsonb,
  cover_letter text,
  submitted_to_email text,
  approval_request_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_stakeholder_reports_st on zameen.stakeholder_reports(stakeholder_id, due_date desc);
create index if not exists idx_stakeholder_reports_status on zameen.stakeholder_reports(status);

create table if not exists zameen.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in (
    'financial','operational','social','environmental','governance'
  )),
  unit text not null,
  formula_description text,
  target_value numeric(14,4),
  target_period text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_kpi_definitions_code on zameen.kpi_definitions(coalesce(entity_id, '00000000-0000-0000-0000-000000000000'), code);

create table if not exists zameen.kpi_actuals (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references zameen.kpi_definitions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  value numeric(14,4) not null,
  target_value numeric(14,4),
  variance_pct numeric(8,2),
  notes text,
  computed_at timestamptz not null default now(),
  unique (kpi_id, period_start, period_end)
);
create index if not exists idx_kpi_actuals_period on zameen.kpi_actuals(kpi_id, period_end desc);

alter table zameen.stakeholders enable row level security;
alter table zameen.stakeholder_reports enable row level security;
alter table zameen.kpi_definitions enable row level security;
alter table zameen.kpi_actuals enable row level security;

create policy st_entity on zameen.stakeholders
  for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy sr_via_st on zameen.stakeholder_reports
  for all using (exists (
    select 1 from zameen.stakeholders s
    where s.id = stakeholder_id
      and s.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
create policy kpid_entity on zameen.kpi_definitions
  for all using (entity_id is null or entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy kpia_via_kpi on zameen.kpi_actuals
  for all using (exists (
    select 1 from zameen.kpi_definitions k
    where k.id = kpi_id
      and (k.entity_id is null or k.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  ));

-- Standard agri KPI catalog (entity_id null = available to all entities).
insert into zameen.kpi_definitions (entity_id, code, name, category, unit, formula_description, target_period) values
  (null, 'yield-per-acre', 'Yield per acre', 'operational', 'kg/acre', 'sum(harvest_kg) / sum(area_acres) by crop plan', 'season'),
  (null, 'cost-per-kg', 'Cost per kg produced', 'financial', 'pkr/kg', 'sum(cost_allocations.amount_pkr) / sum(harvest_kg)', 'season'),
  (null, 'labour-hours-per-acre', 'Labour hours per acre', 'social', 'hours/acre', 'sum(labour_minutes)/60 / sum(area_acres)', 'season'),
  (null, 'water-use-per-kg', 'Water use per kg', 'environmental', 'litres/kg', 'sum(irrigation_litres) / sum(harvest_kg)', 'season'),
  (null, 'women-employment-pct', 'Women employment share', 'social', '%', '100 * count(workers where gender=female) / count(workers)', 'quarter'),
  (null, 'pesticide-volume-trend', 'Pesticide volume trend', 'environmental', 'litres', 'sum(pesticide_application.volume_litres) period over period', 'quarter'),
  (null, 'carbon-footprint', 'Carbon footprint net CO2e', 'environmental', 'tCO2e', 'from latest carbon_assessments.net_co2e_tons', 'year'),
  (null, 'worker-safety-lti', 'Worker safety LTI rate', 'social', 'incidents/200k hours', '200000 * count(lost_time_incidents) / sum(hours_worked)', 'quarter'),
  (null, 'gross-margin-per-acre', 'Gross margin per acre', 'financial', 'pkr/acre', '(revenue - direct_cost) / area_acres', 'season')
on conflict do nothing;

-- Cron: daily stakeholder report due checker at 09:00 PKT (04:00 UTC).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'zameen-stakeholder-report-due-checker',
      '0 4 * * *',
      $cron$ select zameen.invoke_edge_function('stakeholder-report-due-checker'); $cron$
    );
  end if;
end$$;
