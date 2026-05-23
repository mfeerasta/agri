-- 0071 weather indexed claims + loan emi schedules
-- Adds parametric weather triggers that auto draft insurance claims, plus an
-- amortization table for crop loans so EMIs can be tracked and aged.

create table if not exists zameen.weather_index_triggers (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references zameen.insurance_policies(id) on delete cascade,
  trigger_kind text not null check (trigger_kind in (
    'frost_hours',
    'heat_days',
    'rainfall_deficit',
    'rainfall_excess',
    'wind_speed',
    'ndvi_below',
    'soil_moisture_below',
    'locust_within_km'
  )),
  threshold_value numeric(10,3) not null,
  measurement_window_days int not null default 7,
  payout_per_unit_pkr numeric(14,2),
  max_payout_pkr numeric(14,2),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_wit_policy on zameen.weather_index_triggers(policy_id, is_active);

create table if not exists zameen.weather_index_evaluations (
  id uuid primary key default gen_random_uuid(),
  trigger_id uuid not null references zameen.weather_index_triggers(id) on delete cascade,
  evaluated_on date not null,
  measured_value numeric(10,3) not null,
  threshold_value numeric(10,3) not null,
  is_triggered boolean not null,
  computed_payout_pkr numeric(14,2),
  claim_draft_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_wieval_trigger on zameen.weather_index_evaluations(trigger_id, evaluated_on desc);
create unique index if not exists uniq_wieval_per_day on zameen.weather_index_evaluations(trigger_id, evaluated_on);

create table if not exists zameen.loan_emi_schedules (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references zameen.crop_loans(id) on delete cascade,
  installment_number int not null,
  due_on date not null,
  principal_pkr numeric(14,2) not null,
  interest_pkr numeric(14,2) not null,
  total_pkr numeric(14,2) not null,
  paid_on date,
  paid_pkr numeric(14,2),
  status text not null default 'scheduled' check (status in ('scheduled','paid','partial','overdue','waived')),
  payment_record_id uuid
);
create unique index if not exists idx_emi_loan_seq on zameen.loan_emi_schedules(loan_id, installment_number);
create index if not exists idx_emi_due_status on zameen.loan_emi_schedules(due_on, status);

alter table zameen.weather_index_triggers enable row level security;
alter table zameen.weather_index_evaluations enable row level security;
alter table zameen.loan_emi_schedules enable row level security;

create policy wit_via_policy on zameen.weather_index_triggers for all using (
  exists (
    select 1 from zameen.insurance_policies p
    where p.id = policy_id
      and p.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

create policy wie_via_trigger on zameen.weather_index_evaluations for all using (
  exists (
    select 1 from zameen.weather_index_triggers t
    join zameen.insurance_policies p on p.id = t.policy_id
    where t.id = trigger_id
      and p.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

create policy emi_via_loan on zameen.loan_emi_schedules for all using (
  exists (
    select 1 from zameen.crop_loans l
    where l.id = loan_id
      and l.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);
