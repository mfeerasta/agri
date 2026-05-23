create table if not exists zameen.cooperatives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ur text,
  registration_number text,
  authority text,
  registration_date date,
  charter_doc_url text,
  default_meeting_day text,
  bank_account_number text,
  bank_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists zameen.cooperative_members (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references zameen.cooperatives(id) on delete cascade,
  member_name text not null,
  cnic text,
  phone text,
  email text,
  village text,
  total_acres numeric(10,3),
  crops_grown text[],
  joined_on date not null,
  membership_status text not null default 'active' check (membership_status in ('active','suspended','withdrawn','expelled')),
  withdrawal_date date,
  shares_held int not null default 1,
  contribution_pkr_to_date numeric(14,2) not null default 0,
  related_entity_id uuid references zameen.entities(id),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_coop_members on zameen.cooperative_members(cooperative_id);

create table if not exists zameen.group_buying_pools (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references zameen.cooperatives(id) on delete cascade,
  item_name text not null,
  item_kind text not null check (item_kind in ('input_seed','input_fertilizer','input_pesticide','equipment_rental','service','other')),
  target_total_quantity numeric(14,4) not null,
  unit text not null,
  estimated_per_unit_pkr numeric(12,2),
  estimated_savings_pct numeric(5,2),
  status text not null default 'open' check (status in ('open','closed','procured','distributed','cancelled')),
  closes_on date,
  procured_on date,
  actual_per_unit_pkr numeric(12,2),
  vendor_id uuid,
  approval_request_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists zameen.group_buying_pledges (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references zameen.group_buying_pools(id) on delete cascade,
  member_id uuid not null references zameen.cooperative_members(id) on delete cascade,
  pledged_quantity numeric(14,4) not null,
  delivered_quantity numeric(14,4) not null default 0,
  pledge_amount_pkr numeric(14,2),
  paid_pkr numeric(14,2) not null default 0,
  paid_on date,
  status text not null default 'pledged' check (status in ('pledged','paid','delivered','disputed','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists zameen.equipment_sharing_arrangements (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references zameen.assets(id) on delete cascade,
  cooperative_id uuid references zameen.cooperatives(id),
  rate_per_hour_pkr numeric(10,2),
  rate_per_acre_pkr numeric(10,2),
  rate_per_day_pkr numeric(10,2),
  minimum_charge_pkr numeric(10,2),
  fuel_arrangement text check (fuel_arrangement in ('owner_pays','user_pays','split_50_50')),
  operator_provided boolean not null default false,
  operator_rate_pkr numeric(10,2),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists zameen.equipment_rentals (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references zameen.equipment_sharing_arrangements(id) on delete cascade,
  renter_member_id uuid references zameen.cooperative_members(id),
  renter_name text,
  renter_phone text,
  rented_for_field_id uuid,
  start_at timestamptz not null,
  end_at timestamptz,
  hours_used numeric(8,2),
  acres_worked numeric(8,3),
  total_charge_pkr numeric(12,2),
  fuel_charge_pkr numeric(10,2),
  operator_charge_pkr numeric(10,2),
  paid_pkr numeric(12,2) not null default 0,
  status text not null default 'active' check (status in ('booked','active','completed','disputed','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

alter table zameen.cooperatives enable row level security;
alter table zameen.cooperative_members enable row level security;
alter table zameen.group_buying_pools enable row level security;
alter table zameen.group_buying_pledges enable row level security;
alter table zameen.equipment_sharing_arrangements enable row level security;
alter table zameen.equipment_rentals enable row level security;
create policy coop_authenticated on zameen.cooperatives for select using (auth.role() = 'authenticated');
create policy cm_via_coop on zameen.cooperative_members for select using (auth.role() = 'authenticated');
create policy gbp_via_coop on zameen.group_buying_pools for all using (auth.role() = 'authenticated');
create policy gbpld_via_pool on zameen.group_buying_pledges for all using (auth.role() = 'authenticated');
create policy esa_via_asset on zameen.equipment_sharing_arrangements for all using (exists (select 1 from zameen.assets a where a.id = asset_id and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy er_via_arr on zameen.equipment_rentals for all using (exists (select 1 from zameen.equipment_sharing_arrangements ea join zameen.assets a on a.id = ea.asset_id where ea.id = arrangement_id and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
