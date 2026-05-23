-- 0075 transport, logistics, and dispatch routing module.
-- Fleet of vehicles (owned or hired), saved routes between fields and mandis,
-- trips with diesel/toll/allowance costs auto-allocated, and per-trip load
-- plans tying produce lots to trips. GPS track stored inline on the trip row.

create table if not exists zameen.vehicles (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  registration_number text not null,
  make text,
  model text,
  vehicle_type text not null check (vehicle_type in (
    'truck_small','truck_medium','truck_large','tractor_trolley','pickup','suzuki','rickshaw_loader','rented','contractor'
  )),
  payload_capacity_kg numeric(10,2),
  fuel_type text not null default 'diesel',
  fuel_economy_km_per_liter numeric(6,3),
  current_odometer_km numeric(12,2),
  asset_id uuid references zameen.assets(id),
  driver_id uuid references zameen.workers(id),
  is_owned boolean not null default true,
  hire_rate_per_km_pkr numeric(10,2),
  status text not null default 'available' check (status in ('available','dispatched','maintenance','retired')),
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_veh_entity_reg on zameen.vehicles(entity_id, registration_number);

create table if not exists zameen.dispatch_routes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  origin_lat numeric(9,6) not null,
  origin_lng numeric(9,6) not null,
  destinations jsonb not null,
  estimated_distance_km numeric(8,2),
  estimated_duration_minutes int,
  toll_cost_pkr numeric(10,2),
  saved_route_polyline text,
  created_at timestamptz not null default now()
);

create table if not exists zameen.trips (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  trip_number text not null,
  vehicle_id uuid references zameen.vehicles(id),
  driver_id uuid references zameen.workers(id),
  route_id uuid references zameen.dispatch_routes(id),
  trip_purpose text not null check (trip_purpose in (
    'mandi_delivery','input_procurement','inter_farm','emergency','passenger','market_research','other'
  )),
  related_dispatch_id uuid,
  related_purchase_id uuid,
  departed_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  start_odometer_km numeric(12,2),
  end_odometer_km numeric(12,2),
  distance_km numeric(8,2),
  diesel_used_liters numeric(8,2),
  diesel_cost_pkr numeric(12,2),
  toll_cost_pkr numeric(10,2),
  parking_cost_pkr numeric(8,2),
  driver_allowance_pkr numeric(10,2),
  total_trip_cost_pkr numeric(14,2),
  cargo_description text,
  cargo_weight_kg numeric(12,2),
  cargo_photo_urls jsonb not null default '[]'::jsonb,
  proof_of_delivery_urls jsonb not null default '[]'::jsonb,
  gps_track jsonb,
  status text not null default 'planned' check (status in (
    'planned','dispatched','in_transit','delivered','completed','cancelled','failed'
  )),
  approval_request_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_trips_entity_num on zameen.trips(entity_id, trip_number);
create index if not exists idx_trips_vehicle on zameen.trips(vehicle_id, departed_at desc);

create table if not exists zameen.dispatch_load_plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references zameen.trips(id) on delete cascade,
  produce_lot_id uuid references zameen.produce_lots(id),
  kg_loaded numeric(12,2) not null,
  load_order int not null default 0,
  notes text
);

alter table zameen.vehicles enable row level security;
alter table zameen.dispatch_routes enable row level security;
alter table zameen.trips enable row level security;
alter table zameen.dispatch_load_plans enable row level security;

create policy veh_entity on zameen.vehicles for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);
create policy dr_entity on zameen.dispatch_routes for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);
create policy trips_entity on zameen.trips for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);
create policy dlp_via_trip on zameen.dispatch_load_plans for all using (
  exists (
    select 1 from zameen.trips t
    where t.id = trip_id
      and t.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);
