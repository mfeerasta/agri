-- OpenAQ readings keyed per entity. Hourly polled by the air-quality-poller
-- edge function. Latest row drives the field dashboard widget and triggers
-- spray-window notifications.

create table if not exists zameen.air_quality_readings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  station_name text not null,
  fetched_at timestamptz not null default now(),
  pm25 numeric(6,2),
  pm10 numeric(6,2),
  no2 numeric(6,2),
  o3 numeric(6,2),
  so2 numeric(6,2),
  co numeric(6,2),
  aqi int,
  level text check (level in ('good','moderate','unhealthy_sensitive','unhealthy','very_unhealthy','hazardous'))
);

create index if not exists idx_aq_entity_recent on zameen.air_quality_readings(entity_id, fetched_at desc);

alter table zameen.air_quality_readings enable row level security;

drop policy if exists "aq_entity" on zameen.air_quality_readings;
create policy "aq_entity"
  on zameen.air_quality_readings
  for select
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
