-- OpenStreetMap Overpass cache. Public Overpass instances are rate-limited
-- so we cache results per origin (field or farm) for 30 days. Cache eviction
-- is by fetched_at, enforced in application code.

create table if not exists zameen.nearby_features_cache (
  id uuid primary key default gen_random_uuid(),
  origin_kind text not null check (origin_kind in ('field','farm')),
  origin_id uuid not null,
  features jsonb not null,
  fetched_at timestamptz not null default now()
);

create unique index if not exists idx_nearby_origin
  on zameen.nearby_features_cache(origin_kind, origin_id);

alter table zameen.nearby_features_cache enable row level security;

-- Reads are scoped by checking the origin against accessible fields/farms in
-- application code (the SQL policy is permissive but the table is only
-- queried via service role / authenticated server actions).
drop policy if exists "nearby_features_cache_read" on zameen.nearby_features_cache;
create policy "nearby_features_cache_read"
  on zameen.nearby_features_cache
  for select
  using (true);
