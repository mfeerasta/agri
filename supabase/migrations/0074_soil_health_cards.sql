-- Soil health cards, sampling events, and fertilizer recommendations.
-- See packages/db/src/schema/soil-health.ts for the Drizzle mirror, and
-- packages/finance/src/fertilizer-recommendation.ts for the engine.

create table if not exists zameen.soil_health_cards (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  card_number text not null,
  issued_on date not null,
  valid_until date not null,
  laboratory text,
  laboratory_certificate_url text,
  composite_sample_count int,
  ph numeric(4,2),
  electrical_conductivity_ds_per_m numeric(6,3),
  organic_matter_pct numeric(5,2),
  organic_carbon_pct numeric(5,2),
  cec_cmol_per_kg numeric(6,2),
  nitrogen_total_pct numeric(6,3),
  phosphorus_avail_ppm numeric(8,2),
  potassium_avail_ppm numeric(8,2),
  sulphur_ppm numeric(8,2),
  zinc_ppm numeric(6,2),
  iron_ppm numeric(6,2),
  manganese_ppm numeric(6,2),
  copper_ppm numeric(6,2),
  boron_ppm numeric(6,2),
  texture_class text check (texture_class in ('sand','loamy_sand','sandy_loam','loam','silt_loam','silt','sandy_clay_loam','clay_loam','silty_clay_loam','sandy_clay','silty_clay','clay')),
  clay_pct numeric(5,2),
  sand_pct numeric(5,2),
  silt_pct numeric(5,2),
  bulk_density_g_per_cm3 numeric(5,3),
  infiltration_rate_cm_per_hr numeric(6,3),
  carbonate_pct numeric(5,2),
  salinity_class text check (salinity_class in ('non_saline','slightly_saline','moderately_saline','strongly_saline','very_strongly_saline')),
  sodicity_class text check (sodicity_class in ('non_sodic','slightly_sodic','moderately_sodic','strongly_sodic')),
  ai_summary text,
  ai_summary_ur text,
  full_report_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_shc_field on zameen.soil_health_cards(field_id, issued_on desc);
create index if not exists idx_shc_validity on zameen.soil_health_cards(valid_until);

create table if not exists zameen.soil_sampling_events (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  sampled_on date not null,
  sampled_by uuid,
  sampling_method text check (sampling_method in ('grid_systematic','random','zone_based','composite_w','single_point')),
  sample_count int not null,
  depth_cm int not null,
  gps_locations jsonb not null default '[]'::jsonb,
  sent_to_lab text,
  lab_reference_number text,
  expected_result_date date,
  status text not null default 'collected' check (status in ('planned','collected','sent','results_received','completed')),
  resulting_card_id uuid references zameen.soil_health_cards(id),
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  cost_pkr numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists idx_sse_field on zameen.soil_sampling_events(field_id, sampled_on desc);
create index if not exists idx_sse_status on zameen.soil_sampling_events(status);

create table if not exists zameen.fertilizer_recommendations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references zameen.soil_health_cards(id) on delete cascade,
  crop_code text not null,
  target_yield_kg_per_acre numeric(10,2) not null,
  n_kg_per_acre numeric(8,2) not null,
  p2o5_kg_per_acre numeric(8,2) not null,
  k2o_kg_per_acre numeric(8,2) not null,
  zinc_kg_per_acre numeric(6,2),
  sulphur_kg_per_acre numeric(6,2),
  micros_jsonb jsonb,
  organic_recommendations text,
  ai_rationale text,
  computed_at timestamptz not null default now()
);
create index if not exists idx_fr_card on zameen.fertilizer_recommendations(card_id, computed_at desc);

alter table zameen.soil_health_cards enable row level security;
alter table zameen.soil_sampling_events enable row level security;
alter table zameen.fertilizer_recommendations enable row level security;

create policy shc_via_field on zameen.soil_health_cards for all using (
  exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id
      and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

create policy sse_via_field on zameen.soil_sampling_events for all using (
  exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id
      and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

create policy fr_via_card on zameen.fertilizer_recommendations for all using (
  exists (
    select 1 from zameen.soil_health_cards c
    join zameen.fields f on f.id = c.field_id
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where c.id = card_id
      and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);
