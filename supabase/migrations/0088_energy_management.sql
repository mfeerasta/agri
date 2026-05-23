-- Energy management: meters, readings, solar systems, generator runs.
create table if not exists zameen.energy_meters (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  meter_number text not null,
  meter_kind text not null check (meter_kind in ('grid_electricity','solar_inverter','generator','tubewell_pump','cold_storage','farm_kitchen','farmhouse','other')),
  asset_id uuid references zameen.assets(id),
  field_id uuid references zameen.fields(id),
  capacity_kw numeric(10,3),
  tariff_pkr_per_kwh numeric(10,4),
  connection_kind text check (connection_kind in ('agri','commercial','domestic','industrial','solar_net_metering')),
  reference_number text,
  installed_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_em_entity on zameen.energy_meters(entity_id);

create table if not exists zameen.energy_readings (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references zameen.energy_meters(id) on delete cascade,
  reading_date date not null,
  reading_time text not null default 'on_peak' check (reading_time in ('on_peak','off_peak','total')),
  consumption_kwh numeric(12,3),
  generation_kwh numeric(12,3),
  export_kwh numeric(12,3),
  reading_value numeric(14,3) not null,
  cost_pkr numeric(14,2),
  bill_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_er_meter on zameen.energy_readings(meter_id, reading_date desc);

create table if not exists zameen.solar_systems (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  installation_name text not null,
  panels_count int not null,
  total_capacity_kw numeric(10,3) not null,
  panel_model text,
  inverter_model text,
  battery_capacity_kwh numeric(10,3),
  installer text,
  commissioned_on date not null,
  warranty_until date,
  cost_pkr numeric(14,2),
  cost_per_kw_pkr numeric(12,2),
  estimated_annual_generation_kwh numeric(14,2),
  net_metering_approved boolean not null default false,
  notes text
);
create index if not exists idx_sol_entity on zameen.solar_systems(entity_id);

create table if not exists zameen.generator_runs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references zameen.assets(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  hours_run numeric(8,2),
  diesel_consumed_liters numeric(10,2),
  output_kwh_estimated numeric(12,2),
  reason text check (reason in ('grid_outage','peak_shaving','testing','planned_maintenance','event','other')),
  fuel_cost_pkr numeric(14,2),
  operator_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gr_asset on zameen.generator_runs(asset_id, started_at desc);

alter table zameen.energy_meters enable row level security;
alter table zameen.energy_readings enable row level security;
alter table zameen.solar_systems enable row level security;
alter table zameen.generator_runs enable row level security;

create policy em_entity on zameen.energy_meters for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy er_via_meter on zameen.energy_readings for all using (exists (select 1 from zameen.energy_meters m where m.id = meter_id and m.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy ss_entity on zameen.solar_systems for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy gr_via_asset on zameen.generator_runs for all using (exists (select 1 from zameen.assets a where a.id = asset_id and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));

-- Cron: daily energy anomaly detector at 23:00 PKT
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'zameen-energy-anomaly-detector',
      '0 18 * * *',
      $cron$ select zameen.invoke_edge_function('energy-anomaly-detector'); $cron$
    );
  end if;
end$$;
