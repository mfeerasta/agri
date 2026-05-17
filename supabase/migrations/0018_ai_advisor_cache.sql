-- AI advisor response cache. Keyed on (kind, key) where key is typically an
-- entity uuid like a crop_plan_id or approval_request_id. payload stores the
-- full JSON response. Rows past expires_at are purged by pg_cron (see 0019).

create table if not exists zameen.ai_advisor_cache (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('crop_advisor', 'approval_explainer', 'field_summary')),
  key text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (kind, key)
);

create index if not exists idx_advisor_expires on zameen.ai_advisor_cache(expires_at);
create index if not exists idx_advisor_kind_key on zameen.ai_advisor_cache(kind, key);

alter table zameen.ai_advisor_cache enable row level security;

-- Service role only. Cache is shared across the entity.
create policy "advisor_cache_service_only" on zameen.ai_advisor_cache
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
