-- 0017_ndvi.sql
-- Sentinel Hub NDVI observations per field. Cron-pulled daily by the
-- ndvi-puller edge function. One row per (field, observed_on, satellite).
-- See docs/decisions.md (2026-05-17, Sentinel-2 NDVI overlay) for rationale.

create table if not exists zameen.ndvi_observations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  crop_plan_id uuid references zameen.crop_plans(id) on delete set null,
  observed_on date not null,
  satellite text not null check (satellite in ('sentinel-2','landsat-8','landsat-9')) default 'sentinel-2',
  cloud_cover_pct numeric(5,2),
  mean_ndvi numeric(5,4) not null,
  min_ndvi numeric(5,4),
  max_ndvi numeric(5,4),
  std_ndvi numeric(5,4),
  pixels_count int,
  raw_response jsonb,
  preview_image_url text,
  created_at timestamptz not null default now(),
  unique (field_id, observed_on, satellite)
);

create index if not exists idx_ndvi_field on zameen.ndvi_observations(field_id, observed_on desc);

alter table zameen.ndvi_observations enable row level security;

drop policy if exists "ndvi_via_field" on zameen.ndvi_observations;
create policy "ndvi_via_field" on zameen.ndvi_observations for all
  using (
    exists (
      select 1
      from zameen.fields f
      join zameen.blocks b on b.id = f.block_id
      join zameen.farms fa on fa.id = b.farm_id
      where f.id = field_id
        and fa.entity_id in (select auth.user_entities())
    )
  );

-- Schedule the puller. 01:00 UTC = 06:00 PKT, after Sentinel-2 daily processing window.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'zameen-ndvi-puller') then
    perform cron.unschedule('zameen-ndvi-puller');
  end if;
  perform cron.schedule(
    'zameen-ndvi-puller',
    '0 1 * * *',
    $cron$ select zameen.invoke_edge_function('ndvi-puller'); $cron$
  );
exception when undefined_table then
  -- pg_cron not installed in this environment; skip silently.
  null;
end$$;
