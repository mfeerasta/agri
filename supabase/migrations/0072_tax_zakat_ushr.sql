-- 0072 tax periods, ushr settlements, zakat assessments, FBR NTN/STRN records
-- Tracks Pakistan provincial agri income tax, federal income, sales tax,
-- ushr (Islamic agricultural tithe 5pct irrigated, 10pct rain fed), zakat
-- (2.5pct on qualifying wealth), and FBR registrations for Rupafab Agri.

create table if not exists zameen.tax_periods (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  tax_kind text not null check (tax_kind in (
    'punjab_agri_income',
    'federal_income',
    'sales_tax',
    'zakat',
    'ushr',
    'wht_payroll',
    'wht_suppliers',
    'property_tax',
    'vehicle_token',
    'professional_tax',
    'other'
  )),
  period_start date not null,
  period_end date not null,
  due_on date not null,
  filing_status text not null default 'pending' check (filing_status in (
    'pending','prepared','filed','paid','closed','overdue','disputed'
  )),
  computed_amount_pkr numeric(14,2),
  paid_amount_pkr numeric(14,2),
  paid_on date,
  challan_number text,
  challan_url text,
  filing_evidence_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tax_due on zameen.tax_periods(due_on)
  where filing_status in ('pending','prepared');
create index if not exists idx_tax_entity_kind on zameen.tax_periods(entity_id, tax_kind);

create table if not exists zameen.ushr_settlements (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  harvest_record_id uuid,
  crop_plan_id uuid,
  irrigated boolean not null,
  gross_produce_kg numeric(14,2) not null,
  ushr_rate_pct numeric(5,2) not null,
  ushr_kg numeric(14,2) not null,
  ushr_value_pkr numeric(14,2),
  settled_on date,
  paid_to text,
  paid_in_kind boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ushr_field on zameen.ushr_settlements(field_id);
create index if not exists idx_ushr_harvest on zameen.ushr_settlements(harvest_record_id);

create table if not exists zameen.zakat_assessments (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  assessment_date date not null,
  hijri_year int not null,
  nisab_pkr numeric(14,2) not null,
  cash_pkr numeric(14,2) not null default 0,
  bank_balances_pkr numeric(14,2) not null default 0,
  receivables_pkr numeric(14,2) not null default 0,
  inventory_value_pkr numeric(14,2) not null default 0,
  liquid_livestock_value_pkr numeric(14,2) not null default 0,
  debts_owed_pkr numeric(14,2) not null default 0,
  net_zakatable_wealth_pkr numeric(14,2) not null,
  zakat_due_pkr numeric(14,2) not null,
  paid_pkr numeric(14,2) not null default 0,
  paid_to text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_zakat_entity_year on zameen.zakat_assessments(entity_id, hijri_year);

create table if not exists zameen.ntn_strn_records (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  ntn text,
  strn text,
  fbr_principal_activity text,
  registration_date date,
  pra_registration_id text,
  cnic_of_principal text,
  status text default 'active',
  notes text
);
create index if not exists idx_ntn_entity on zameen.ntn_strn_records(entity_id);

-- Auto create ushr settlement when a harvest record is inserted. Default
-- irrigated assumption is true (Punjab canal/tubewell dominant). Operations
-- can toggle the flag on the ushr settlement record itself.
create or replace function zameen.ushr_after_harvest()
returns trigger
language plpgsql
security definer
set search_path = zameen, public
as $$
declare
  v_field_id uuid;
  v_irrigated boolean := true;
  v_rate numeric(5,2);
begin
  select cp.field_id into v_field_id from zameen.crop_plans cp where cp.id = new.crop_plan_id;
  if v_field_id is null then return new; end if;
  v_rate := case when v_irrigated then 5.00 else 10.00 end;
  insert into zameen.ushr_settlements (
    field_id, harvest_record_id, crop_plan_id, irrigated,
    gross_produce_kg, ushr_rate_pct, ushr_kg, paid_in_kind
  ) values (
    v_field_id, new.id, new.crop_plan_id, v_irrigated,
    new.gross_yield_kg, v_rate,
    round(new.gross_yield_kg * v_rate / 100.0, 2), true
  );
  return new;
end;
$$;

drop trigger if exists trg_ushr_after_harvest on zameen.harvest_records;
create trigger trg_ushr_after_harvest
  after insert on zameen.harvest_records
  for each row execute function zameen.ushr_after_harvest();

alter table zameen.tax_periods enable row level security;
alter table zameen.ushr_settlements enable row level security;
alter table zameen.zakat_assessments enable row level security;
alter table zameen.ntn_strn_records enable row level security;

create policy tp_entity on zameen.tax_periods for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy us_via_field on zameen.ushr_settlements for all
  using (exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id
      and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
create policy za_entity on zameen.zakat_assessments for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy ntn_entity on zameen.ntn_strn_records for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
