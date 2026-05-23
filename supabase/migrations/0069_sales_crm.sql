-- Sales pipeline + buyer CRM + forward-contract module.
-- Entirely within zameen.* schema. No cross-schema links.

create table if not exists zameen.buyers_crm (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  name_ur text,
  buyer_type text not null check (buyer_type in ('mandi_arhti','flour_mill','rice_mill','sugar_mill','exporter','wholesale','retail','government','other')),
  contact_person text,
  phone text,
  alt_phone text,
  email text,
  cnic text,
  ntn text,
  address text,
  location jsonb,
  payment_terms_days int,
  credit_limit_pkr numeric(14,2),
  notes text,
  status text not null default 'active' check (status in ('active','dormant','blacklisted')),
  blacklisted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_buyers_crm_entity on zameen.buyers_crm(entity_id);

create table if not exists zameen.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  buyer_id uuid references zameen.buyers_crm(id),
  buyer_name_freeform text,
  crop_code text not null,
  estimated_kg numeric(14,2) not null,
  target_price_per_kg_pkr numeric(12,2),
  stage text not null default 'lead' check (stage in ('lead','qualified','negotiating','contracted','delivered','lost')),
  expected_close_date date,
  actual_close_date date,
  win_probability_pct int check (win_probability_pct between 0 and 100),
  source text,
  lost_reason text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_opps_stage on zameen.sales_opportunities(entity_id, stage);

create table if not exists zameen.forward_contracts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  buyer_id uuid not null references zameen.buyers_crm(id),
  contract_number text not null,
  signed_on date not null,
  crop_code text not null,
  committed_kg numeric(14,2) not null,
  agreed_price_per_kg_pkr numeric(12,2) not null,
  delivery_window_start date not null,
  delivery_window_end date not null,
  delivery_point text,
  payment_terms text,
  advance_received_pkr numeric(14,2) not null default 0,
  advance_received_on date,
  quality_specs jsonb,
  penalty_clause text,
  status text not null default 'open' check (status in ('open','partially_delivered','fulfilled','breached','cancelled')),
  delivered_kg numeric(14,2) not null default 0,
  delivered_pkr numeric(14,2) not null default 0,
  contract_doc_url text,
  approval_request_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_fwd_entity_num on zameen.forward_contracts(entity_id, contract_number);

create table if not exists zameen.contract_deliveries (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references zameen.forward_contracts(id) on delete cascade,
  delivered_on date not null,
  kg numeric(14,2) not null,
  pkr numeric(14,2) not null,
  produce_lot_ids uuid[] not null default '{}',
  delivery_note_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- Extend approval_type enum.
alter type zameen.approval_type add value if not exists 'forward_contract';

-- RLS.
alter table zameen.buyers_crm enable row level security;
alter table zameen.sales_opportunities enable row level security;
alter table zameen.forward_contracts enable row level security;
alter table zameen.contract_deliveries enable row level security;

create policy buyers_crm_entity on zameen.buyers_crm for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy opps_entity on zameen.sales_opportunities for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy fwd_entity on zameen.forward_contracts for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy fd_via_contract on zameen.contract_deliveries for all
  using (exists (
    select 1 from zameen.forward_contracts c
    where c.id = contract_id
      and c.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
