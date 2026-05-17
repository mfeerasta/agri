-- 0016_diesel_anomalies.sql
-- Persist diesel anomaly events so operators can acknowledge or resolve them.

create table if not exists zameen.diesel_anomalies (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  asset_id uuid not null references zameen.assets(id) on delete cascade,
  diesel_daily_log_id uuid references zameen.diesel_daily_logs(id) on delete cascade,
  detected_on date not null,
  rolling_30d_avg_lph numeric(10,3) not null,
  observed_lph numeric(10,3) not null,
  deviation_pct numeric(6,2) not null,
  severity text not null check (severity in ('warning','high','critical')) default 'warning',
  status text not null check (status in ('open','acknowledged','dismissed','resolved')) default 'open',
  acknowledged_by uuid references zameen.users(id),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_anomalies_status on zameen.diesel_anomalies(status, detected_on desc);
create index if not exists idx_anomalies_asset on zameen.diesel_anomalies(asset_id, detected_on desc);

alter table zameen.diesel_anomalies enable row level security;

create policy "anomalies_entity" on zameen.diesel_anomalies for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  with check (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
