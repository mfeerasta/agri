-- Livestock daily operations: herds, milk production, feed issuance, breeding, health.
-- Schema-isolated under zameen.*. No cross-schema joins to Haazri/Sentinel.

-- Add 'feed' as a first-class input type so livestock feed inventory can live alongside crop inputs.
alter type zameen.input_type add value if not exists 'feed';

-- Herds (groups of animals: e.g. "Sahiwal milking herd", "Goat kids")
create table if not exists zameen.livestock_herds (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  name_ur text,
  species text not null check (species in ('cattle','buffalo','goat','sheep','other')),
  purpose text check (purpose in ('dairy','meat','breeding','mixed')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_livestock_herds_entity on zameen.livestock_herds(entity_id);

-- Add herd link onto animals (nullable; backfilled later)
alter table zameen.animals
  add column if not exists herd_id uuid references zameen.livestock_herds(id) on delete set null;

-- Milk production daily log (animal- or herd-level; AM/PM shift)
create table if not exists zameen.milk_production_logs (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid references zameen.animals(id) on delete cascade,
  herd_id uuid references zameen.livestock_herds(id) on delete cascade,
  log_date date not null,
  shift text not null check (shift in ('morning','evening')),
  liters numeric(8,2) not null,
  fat_pct numeric(5,2),
  snf_pct numeric(5,2),
  notes text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  check (animal_id is not null or herd_id is not null)
);
create index if not exists idx_milk_prod_date on zameen.milk_production_logs(log_date desc);
create index if not exists idx_milk_prod_animal on zameen.milk_production_logs(animal_id, log_date desc);
create index if not exists idx_milk_prod_herd on zameen.milk_production_logs(herd_id, log_date desc);

-- Feed issuance to herds or individual animals (mirrors input_issuances pattern)
create table if not exists zameen.feed_issuances (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id),
  input_id uuid not null references zameen.inputs(id),
  herd_id uuid references zameen.livestock_herds(id),
  animal_id uuid references zameen.animals(id),
  issued_on timestamptz not null,
  quantity numeric(14,4) not null,
  unit_cost_pkr numeric(14,2) not null,
  total_cost_pkr numeric(14,2) not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (herd_id is not null or animal_id is not null)
);
create index if not exists idx_feed_issuances_date on zameen.feed_issuances(issued_on desc);
create index if not exists idx_feed_issuances_herd on zameen.feed_issuances(herd_id, issued_on desc);
create index if not exists idx_feed_issuances_animal on zameen.feed_issuances(animal_id, issued_on desc);

-- Breeding cycles (one row per breeding cycle for a female animal).
-- Named *_cycles to coexist with the legacy zameen.breeding_events (lightweight log) created in 0001.
create table if not exists zameen.livestock_breeding_cycles (
  id uuid primary key default gen_random_uuid(),
  female_animal_id uuid not null references zameen.animals(id) on delete cascade,
  male_animal_id uuid references zameen.animals(id),
  semen_source text,
  bred_on date not null,
  confirmed_pregnant_on date,
  expected_calving_date date,
  actual_calving_date date,
  offspring_count int,
  outcome text check (outcome in ('pending','pregnant','aborted','calved','failed')),
  vet_name text,
  cost_pkr numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_lbc_female on zameen.livestock_breeding_cycles(female_animal_id, bred_on desc);
create index if not exists idx_lbc_expected on zameen.livestock_breeding_cycles(expected_calving_date) where outcome in ('pending','pregnant');

-- Health events with photo evidence
create table if not exists zameen.livestock_health_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references zameen.animals(id) on delete cascade,
  event_kind text not null check (event_kind in ('vaccination','treatment','illness','injury','deworming','hoof_trim','death')),
  occurred_on date not null,
  diagnosis text,
  medication text,
  dosage text,
  vet_name text,
  cost_pkr numeric(12,2),
  withdrawal_period_days int,
  next_due_on date,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_health_animal on zameen.livestock_health_events(animal_id, occurred_on desc);
create index if not exists idx_health_next_due on zameen.livestock_health_events(next_due_on) where next_due_on is not null;

-- RLS
alter table zameen.livestock_herds enable row level security;
alter table zameen.milk_production_logs enable row level security;
alter table zameen.feed_issuances enable row level security;
alter table zameen.livestock_breeding_cycles enable row level security;
alter table zameen.livestock_health_events enable row level security;

create policy lh_entity on zameen.livestock_herds for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);

create policy mpl_via_animal_or_herd on zameen.milk_production_logs for all using (
  (animal_id is not null and exists (
    select 1 from zameen.animals a where a.id = animal_id
      and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ))
  or (herd_id is not null and exists (
    select 1 from zameen.livestock_herds h where h.id = herd_id
      and h.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ))
);

create policy fi_entity on zameen.feed_issuances for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);

create policy lbc_via_animal on zameen.livestock_breeding_cycles for all using (
  exists (select 1 from zameen.animals a where a.id = female_animal_id
    and a.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
);

create policy lhe_via_animal on zameen.livestock_health_events for all using (
  exists (select 1 from zameen.animals a where a.id = animal_id
    and a.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
);
