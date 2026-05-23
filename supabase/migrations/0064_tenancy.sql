-- Tenant / lease management
-- Punjab agri tenure: owned, rented in/out, sharecrop (battai/musharka)

create table if not exists zameen.lease_contracts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  field_id uuid not null references zameen.fields(id) on delete cascade,
  counterparty_name text not null,
  counterparty_cnic text,
  counterparty_phone text,
  tenure text not null check (tenure in ('owned','rented_in','rented_out','sharecrop_in','sharecrop_out','musharka','other')),
  start_date date not null,
  end_date date,
  annual_rent_pkr numeric(14,2),
  rent_payment_schedule text check (rent_payment_schedule in ('annual','semi_annual','quarterly','monthly','seasonal')),
  share_pct_landowner numeric(5,2),
  share_pct_tenant numeric(5,2),
  input_share_arrangement jsonb,
  deed_doc_url text,
  status text not null default 'active' check (status in ('active','expired','terminated','disputed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lease_field on zameen.lease_contracts(field_id);
create index if not exists idx_lease_active on zameen.lease_contracts(status) where status = 'active';

create table if not exists zameen.lease_payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references zameen.lease_contracts(id) on delete cascade,
  paid_on date not null,
  amount_pkr numeric(14,2) not null,
  payment_method text not null,
  reference_number text,
  receipt_url text,
  notes text,
  created_by uuid,
  approval_request_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_lease_pmt on zameen.lease_payments(lease_id, paid_on desc);

create table if not exists zameen.sharecrop_settlements (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references zameen.lease_contracts(id) on delete cascade,
  crop_plan_id uuid,
  harvest_record_id uuid,
  settled_on date not null,
  gross_produce_kg numeric(14,2) not null,
  gross_revenue_pkr numeric(14,2) not null,
  deductions_pkr numeric(14,2) not null default 0,
  landowner_share_pkr numeric(14,2) not null,
  tenant_share_pkr numeric(14,2) not null,
  paid_to_landowner_on date,
  notes text,
  created_at timestamptz not null default now()
);

alter table zameen.lease_contracts enable row level security;
alter table zameen.lease_payments enable row level security;
alter table zameen.sharecrop_settlements enable row level security;

create policy lc_entity on zameen.lease_contracts for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy lp_via_lease on zameen.lease_payments for all using (exists (select 1 from zameen.lease_contracts c where c.id = lease_id and c.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy ss_via_lease on zameen.sharecrop_settlements for all using (exists (select 1 from zameen.lease_contracts c where c.id = lease_id and c.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));

-- Extend approval_type enum with lease_payment
do $$ begin
  alter type zameen.approval_type add value if not exists 'lease_payment';
exception when duplicate_object then null;
end $$;
