-- 0054-external-advisories
-- PARC + FAO crop advisories ingested via admin PDF upload. AI summaries
-- surfaced contextually on crop plan detail pages.

create table if not exists zameen.external_advisories (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id) on delete cascade,
  source text not null,
  title text not null,
  published_on date not null,
  region text,
  commodities text[] not null default '{}',
  pdf_url text,
  ai_summary text,
  ai_summary_ur text,
  key_recommendations jsonb not null default '[]'::jsonb,
  ingested_by uuid references zameen.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_advisories_published on zameen.external_advisories(published_on desc);
create index if not exists idx_advisories_commodities on zameen.external_advisories using gin(commodities);

alter table zameen.external_advisories enable row level security;

drop policy if exists "advisories_authenticated" on zameen.external_advisories;
create policy "advisories_authenticated" on zameen.external_advisories for select using (auth.role() = 'authenticated');

drop policy if exists "advisories_admin_write" on zameen.external_advisories;
create policy "advisories_admin_write" on zameen.external_advisories for all using (
  exists (
    select 1 from zameen.user_entity_roles
    where user_id = auth.uid()
      and role in ('director','super_admin','farm_manager')
      and is_active = true
  )
);
