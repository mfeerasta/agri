-- NASA SMAP L-band soil-moisture observations at the field level. Used to
-- cross-validate Open-Meteo and in-field soil-moisture probes. Populated
-- weekly by the nasa-appeears-poller edge function.

create table if not exists zameen.smap_observations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  observed_on date not null,
  soil_moisture_m3m3 numeric(5,3) not null,
  retrieval_quality numeric(3,2),
  source text not null default 'smap',
  created_at timestamptz not null default now(),
  unique (field_id, observed_on, source)
);

create index if not exists idx_smap_field on zameen.smap_observations(field_id, observed_on desc);

alter table zameen.smap_observations enable row level security;

create policy "smap_via_field" on zameen.smap_observations
  for all
  using (
    exists (
      select 1
      from zameen.fields f
      join zameen.blocks b on b.id = f.block_id
      join zameen.farms fa on fa.id = b.farm_id
      where f.id = smap_observations.field_id
        and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
    )
  );
