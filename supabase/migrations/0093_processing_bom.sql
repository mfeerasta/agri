-- Processing BOM + recipe costing + yield tracking.
-- Rupafab processes raw produce (wheat to flour, sugarcane to gur, milk to butter).
-- Each run consumes inputs + labour + energy and yields graded outputs + byproducts.
-- No links to Sentinel or Haazri.

create table if not exists zameen.processing_recipes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  process_kind text not null check (process_kind in (
    'wheat_milling','rice_milling','dairy_processing','oil_extraction',
    'cotton_ginning','sugar_processing','gur_making','fodder_processing',
    'seed_cleaning','feed_mixing','packaging','other'
  )),
  inputs jsonb not null,
  outputs jsonb not null,
  byproducts jsonb,
  energy_kwh_per_unit numeric(8,3),
  labour_minutes_per_unit numeric(8,2),
  expected_total_yield_pct numeric(5,2),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_pr_entity on zameen.processing_recipes(entity_id, is_active);

create table if not exists zameen.processing_runs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  recipe_id uuid not null references zameen.processing_recipes(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_hours numeric(8,2),
  inputs_used jsonb not null,
  outputs_produced jsonb not null,
  actual_yield_pct numeric(5,2),
  variance_from_expected_pct numeric(6,2),
  total_input_cost_pkr numeric(14,2),
  energy_cost_pkr numeric(14,2),
  labour_cost_pkr numeric(14,2),
  overhead_cost_pkr numeric(14,2),
  total_run_cost_pkr numeric(14,2),
  per_unit_output_cost_pkr jsonb,
  operator_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_prun_entity on zameen.processing_runs(entity_id, started_at desc);
create index if not exists idx_prun_recipe on zameen.processing_runs(recipe_id);

create table if not exists zameen.byproduct_inventory (
  id uuid primary key default gen_random_uuid(),
  processing_run_id uuid not null references zameen.processing_runs(id) on delete cascade,
  byproduct_kind text not null,
  quantity_kg numeric(14,2) not null,
  unit_value_pkr numeric(12,2),
  storage_location_id uuid,
  disposed_on date,
  disposal_kind text check (disposal_kind in (
    'sold','fed_livestock','composted','given_away','disposed','still_held'
  )),
  proceeds_pkr numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists idx_bi_run on zameen.byproduct_inventory(processing_run_id);
create index if not exists idx_bi_open on zameen.byproduct_inventory(disposal_kind) where disposed_on is null;

alter table zameen.processing_recipes enable row level security;
alter table zameen.processing_runs enable row level security;
alter table zameen.byproduct_inventory enable row level security;

create policy pr_entity on zameen.processing_recipes
  for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy run_entity on zameen.processing_runs
  for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy bi_via_run on zameen.byproduct_inventory
  for all using (exists (
    select 1 from zameen.processing_runs r
    where r.id = processing_run_id
      and r.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));

-- Seed common recipes for every existing entity.
do $$
declare ent record;
begin
  for ent in select id from zameen.entities loop
    insert into zameen.processing_recipes (entity_id, name, process_kind, inputs, outputs, byproducts, energy_kwh_per_unit, labour_minutes_per_unit, expected_total_yield_pct, notes)
    values
      (ent.id, 'Wheat milling (atta + suji + bran)', 'wheat_milling',
        '[{"crop":"wheat","quantity_kg":1000,"grade":"a"}]'::jsonb,
        '[{"name":"atta","quantity_kg":720,"grade":"a"},{"name":"suji","quantity_kg":150,"grade":"a"},{"name":"bran","quantity_kg":100,"grade":"b"}]'::jsonb,
        '[{"kind":"waste_dust","quantity_kg":30}]'::jsonb,
        45.0, 60, 97.0, 'Standard chakki + roller flow.'),
      (ent.id, 'Rice milling (paddy to head rice)', 'rice_milling',
        '[{"crop":"paddy","quantity_kg":1000,"grade":"a"}]'::jsonb,
        '[{"name":"head_rice","quantity_kg":650,"grade":"a"},{"name":"broken_rice","quantity_kg":100,"grade":"b"}]'::jsonb,
        '[{"kind":"husk","quantity_kg":220},{"kind":"bran","quantity_kg":30}]'::jsonb,
        60.0, 75, 97.0, 'De-husk, polish, grade.'),
      (ent.id, 'Dairy butter churning', 'dairy_processing',
        '[{"crop":"milk","quantity_kg":10,"grade":"a"}]'::jsonb,
        '[{"name":"butter","quantity_kg":0.4,"grade":"a"}]'::jsonb,
        '[{"kind":"buttermilk","quantity_kg":9.0}]'::jsonb,
        2.5, 25, 94.0, '10L whole milk yields ~400g butter.'),
      (ent.id, 'Sugarcane to gur', 'gur_making',
        '[{"crop":"sugarcane","quantity_kg":1000,"grade":"a"}]'::jsonb,
        '[{"name":"gur","quantity_kg":100,"grade":"a"}]'::jsonb,
        '[{"kind":"bagasse","quantity_kg":800}]'::jsonb,
        0.0, 180, 90.0, 'Bagasse fires the kohlu, no external energy.')
    on conflict do nothing;
  end loop;
end$$;
