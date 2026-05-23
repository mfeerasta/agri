-- FAO Locust Hub alerts. Rows are appended by the locust-poller edge function
-- whenever a swarm report within the configured radius (default 500km) is
-- observed in the last 90 days. Idempotent on (entity_id, lat, lng, reported_on).

create table if not exists zameen.locust_alerts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  reported_on date not null,
  country text not null,
  region text,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  swarm_stage text not null check (swarm_stage in ('solitary','transient','gregarious')),
  size text check (size in ('small','medium','large')),
  distance_km numeric(8,2),
  source_url text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entity_id, lat, lng, reported_on)
);

create index if not exists idx_locust_entity on zameen.locust_alerts(entity_id, reported_on desc);
create index if not exists idx_locust_stage_distance on zameen.locust_alerts(entity_id, swarm_stage, distance_km);

alter table zameen.locust_alerts enable row level security;

create policy "locust_entity" on zameen.locust_alerts
  for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
