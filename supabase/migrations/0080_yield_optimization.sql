-- Yield optimization: variety catalogue, multi-season trials, harvest losses.
-- All money in PKR. No FX. Photo evidence required for loss claims at app layer.

create table if not exists zameen.crop_varieties (
  id uuid primary key default gen_random_uuid(),
  crop_profile_code text not null,
  name text not null,
  name_ur text,
  variety_kind text check (variety_kind in ('open_pollinated','hybrid','f1','desi','imported','heirloom')),
  source_company text,
  release_year int,
  attributes jsonb,
  recommended_for_zones text[],
  resistance_traits text[],
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_var_profile on zameen.crop_varieties(crop_profile_code);

create table if not exists zameen.variety_trials (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  field_id uuid not null references zameen.fields(id),
  crop_plan_id uuid,
  variety_id uuid not null references zameen.crop_varieties(id),
  season text not null,
  planted_on date not null,
  harvested_on date,
  area_acres numeric(8,3) not null,
  yield_kg numeric(14,2),
  yield_per_acre_kg numeric(10,2),
  quality_grade text,
  disease_pressure_severity int check (disease_pressure_severity between 0 and 5),
  pest_pressure_severity int check (pest_pressure_severity between 0 and 5),
  weather_stress_notes text,
  net_revenue_pkr numeric(14,2),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_vt_entity on zameen.variety_trials(entity_id, season);
create index if not exists idx_vt_variety on zameen.variety_trials(variety_id);

create table if not exists zameen.harvest_loss_records (
  id uuid primary key default gen_random_uuid(),
  harvest_record_id uuid not null,
  field_id uuid references zameen.fields(id),
  loss_kind text not null check (loss_kind in (
    'shattering','spillage','rain_damage','bird_damage','rodent_damage',
    'storage_pest','quality_downgrade','rejection','other'
  )),
  estimated_kg numeric(14,2) not null,
  estimated_value_pkr numeric(14,2),
  cause text,
  preventable boolean,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_hlr_harvest on zameen.harvest_loss_records(harvest_record_id);

-- Link harvest_records to a specific variety so historical analytics
-- can roll up variety performance without going through crop_plans.
alter table zameen.harvest_records
  add column if not exists variety_id uuid references zameen.crop_varieties(id);
