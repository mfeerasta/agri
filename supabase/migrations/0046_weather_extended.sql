-- 0046_weather_extended
-- Extend weather_records with agroclimate columns; add hourly forecast cache
-- and 40-year climate normals tables. Open-Meteo + NASA POWER sourced.

alter table zameen.weather_records add column if not exists et0_mm numeric(6,3);
alter table zameen.weather_records add column if not exists gdd_accumulated numeric(8,2);
alter table zameen.weather_records add column if not exists soil_moisture_0to10 numeric(5,3);
alter table zameen.weather_records add column if not exists soil_moisture_10to40 numeric(5,3);
alter table zameen.weather_records add column if not exists frost_hours int;
alter table zameen.weather_records add column if not exists leaf_wetness_hours int;
alter table zameen.weather_records add column if not exists uv_index_max numeric(4,2);
alter table zameen.weather_records add column if not exists wind_gust_kph numeric(6,2);
alter table zameen.weather_records add column if not exists data_source text default 'pmd';

create table if not exists zameen.weather_hourly (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  forecast_time timestamptz not null,
  fetched_at timestamptz not null default now(),
  temp_c numeric(5,2),
  rainfall_mm numeric(6,3),
  humidity_pct numeric(5,2),
  wind_kph numeric(6,2),
  wind_gust_kph numeric(6,2),
  uv_index numeric(4,2),
  soil_moisture_0to10 numeric(5,3),
  cloud_cover_pct numeric(5,2),
  source text not null default 'open-meteo',
  unique (entity_id, forecast_time, source)
);
create index if not exists idx_weather_hourly_entity on zameen.weather_hourly(entity_id, forecast_time);

create table if not exists zameen.climate_normals (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  start_year int not null,
  end_year int not null,
  monthly_mean_temp_c numeric(5,2)[] not null,
  monthly_total_rain_mm numeric(7,2)[] not null,
  monthly_et0_mm numeric(6,2)[] not null,
  computed_at timestamptz not null default now(),
  source text not null default 'nasa-power',
  unique (entity_id, source)
);

alter table zameen.weather_hourly enable row level security;
create policy "weather_hourly_entity" on zameen.weather_hourly for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

alter table zameen.climate_normals enable row level security;
create policy "climate_normals_entity" on zameen.climate_normals for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
