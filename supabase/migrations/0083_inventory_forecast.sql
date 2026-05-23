-- Inventory forecasting, reorder rules, and anomaly detection.
-- All quantities in input native units (kg, L, bag) per zameen.inputs.unit.
-- All prices PKR. No FX. Photo evidence is not required for forecasts
-- but is required for any auto-created RFQ at the procurement layer.

create table if not exists zameen.inventory_forecasts (
  id uuid primary key default gen_random_uuid(),
  input_id uuid not null references zameen.inputs(id) on delete cascade,
  computed_at timestamptz not null default now(),
  current_stock numeric(14,4) not null,
  daily_velocity numeric(12,4) not null,
  std_dev numeric(12,4),
  days_until_stockout int,
  recommended_reorder_quantity numeric(14,4),
  recommended_reorder_by_date date,
  forecast_horizon_days int not null default 90,
  forecast_payload jsonb not null
);
create index if not exists idx_invf_input on zameen.inventory_forecasts(input_id, computed_at desc);

create table if not exists zameen.reorder_rules (
  id uuid primary key default gen_random_uuid(),
  input_id uuid not null references zameen.inputs(id) on delete cascade,
  rule_kind text not null check (rule_kind in ('reorder_point','periodic','eoq','manual')),
  reorder_point numeric(14,4),
  reorder_quantity numeric(14,4),
  review_period_days int,
  safety_stock_days int not null default 7,
  preferred_vendor_id uuid,
  auto_create_rfq boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_rr_input on zameen.reorder_rules(input_id) where is_active = true;

create table if not exists zameen.inventory_anomalies (
  id uuid primary key default gen_random_uuid(),
  input_id uuid not null references zameen.inputs(id) on delete cascade,
  detected_on date not null,
  observed_quantity numeric(14,4) not null,
  expected_quantity numeric(14,4) not null,
  std_dev_away numeric(6,2) not null,
  anomaly_kind text not null check (anomaly_kind in ('unusual_high_usage','unusual_low_usage','stockout','expired_unused','batch_mismatch','reconciliation_variance')),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ia_input on zameen.inventory_anomalies(input_id, detected_on desc);
create index if not exists idx_ia_unresolved on zameen.inventory_anomalies(detected_on desc) where resolved_at is null;

alter table zameen.inventory_forecasts enable row level security;
alter table zameen.reorder_rules enable row level security;
alter table zameen.inventory_anomalies enable row level security;

create policy invf_via_input on zameen.inventory_forecasts
  for select using (
    exists (
      select 1 from zameen.inputs i
      where i.id = input_id
        and i.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
    )
  );

create policy rr_via_input on zameen.reorder_rules
  for all using (
    exists (
      select 1 from zameen.inputs i
      where i.id = input_id
        and i.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
    )
  );

create policy ia_via_input on zameen.inventory_anomalies
  for all using (
    exists (
      select 1 from zameen.inputs i
      where i.id = input_id
        and i.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
    )
  );

-- Cron: daily 04:00 PKT == 23:00 UTC (previous day).
select cron.unschedule(j.jobname) from cron.job j
  where j.jobname = 'zameen-inventory-forecast-runner';
select cron.schedule(
  'zameen-inventory-forecast-runner',
  '0 23 * * *',
  $$ select zameen.invoke_edge_function('inventory-forecast-runner'); $$
);
