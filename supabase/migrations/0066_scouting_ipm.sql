-- Scouting + IPM (integrated pest management).
-- Captures field observations of pests/diseases, action thresholds per crop+pest,
-- and beneficial-insect counts so the spray planner can recommend softer chemistry
-- when natural enemies are present. Schema isolated under zameen.*.

-- Scouting observations
create table if not exists zameen.scouting_observations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  crop_plan_id uuid,
  observed_at timestamptz not null,
  observer_id uuid,
  scout_method text check (scout_method in ('w_pattern','x_pattern','random','perimeter','full_field')),
  sample_count int,
  pest_or_disease text not null,
  severity int not null check (severity between 1 and 5),
  prevalence_pct numeric(5,2),
  growth_stage text,
  gps_location jsonb,
  photo_urls jsonb not null default '[]'::jsonb,
  voice_note_url text,
  ai_diagnostic_id uuid references zameen.crop_diagnostics(id) on delete set null,
  recommended_action text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_scout_field_date on zameen.scouting_observations(field_id, observed_at desc);
create index if not exists idx_scout_pest on zameen.scouting_observations(pest_or_disease);

-- Action thresholds (per crop x pest)
create table if not exists zameen.action_thresholds (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id) on delete cascade,
  crop_code text not null,
  pest_or_disease text not null,
  threshold_severity int,
  threshold_prevalence_pct numeric(5,2),
  recommended_response text not null,
  ipm_notes text,
  source text,
  unique nulls not distinct (entity_id, crop_code, pest_or_disease)
);
create index if not exists idx_action_thresholds_crop on zameen.action_thresholds(crop_code, pest_or_disease);

-- Beneficial insects log (encouraged side of IPM)
create table if not exists zameen.beneficial_insect_logs (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  observed_at timestamptz not null,
  species text not null,
  count_estimate int,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_beneficial_field_date on zameen.beneficial_insect_logs(field_id, observed_at desc);

alter table zameen.scouting_observations enable row level security;
alter table zameen.action_thresholds enable row level security;
alter table zameen.beneficial_insect_logs enable row level security;

create policy so_via_field on zameen.scouting_observations for all using (
  exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

create policy at_entity on zameen.action_thresholds for all using (
  entity_id is null or entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);

create policy bil_via_field on zameen.beneficial_insect_logs for all using (
  exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);

-- Seed default action thresholds (Punjab Agri Dept extension service values).
-- entity_id null means "applies to all entities unless overridden".
insert into zameen.action_thresholds (entity_id, crop_code, pest_or_disease, threshold_severity, threshold_prevalence_pct, recommended_response, ipm_notes, source) values
  (null, 'wheat', 'yellow_rust',    2, 5.00,  'Apply propiconazole 25EC at 200 ml/acre when 5 percent leaf area shows pustules.', 'Use resistant varieties (Akbar 19, Anaj 17). Avoid late sowing. Monitor every 7 days.', 'Punjab Agri Dept'),
  (null, 'wheat', 'aphid',          3, 10.00, 'Spray dimethoate 40EC at 200 ml/acre or imidacloprid 200SL at 80 ml/acre if 5 to 8 aphids per tiller.', 'Encourage lady beetles and lacewings. Avoid early nitrogen flushes that drive aphid buildup.', 'Punjab Agri Dept'),
  (null, 'wheat', 'armyworm',       3, 5.00,  'Spray emamectin benzoate 5SG at 80 g/acre when 1 to 2 larvae per square foot.', 'Hand-pick larvae early morning. Maintain field sanitation, destroy stubble.', 'Punjab Agri Dept'),
  (null, 'maize', 'fall_armyworm',  3, 5.00,  'Spray chlorantraniliprole 18.5SC at 50 ml/acre when 5 percent plants show fresh damage.', 'Scout twice weekly during whorl stage. Use pheromone traps at 4 per acre. Encourage Trichogramma releases.', 'Punjab Agri Dept'),
  (null, 'maize', 'stem_borer',     3, 10.00, 'Apply cartap hydrochloride 4G at 8 kg/acre into the whorl when 10 percent plants show dead hearts.', 'Release Trichogramma chilonis at 50,000 per acre. Destroy stubble after harvest.', 'Punjab Agri Dept'),
  (null, 'cotton', 'whitefly',      3, 0.00,  'Spray pyriproxyfen 10.8EC at 200 ml/acre when 5 adults per leaf (3 leaves from top).', 'Avoid synthetic pyrethroids early season. Plant yellow sticky traps at 10 per acre. Preserve Encarsia.', 'Punjab Agri Dept'),
  (null, 'cotton', 'pink_bollworm', 3, 5.00,  'Use spinosad 240SC at 80 ml/acre when 8 percent green bolls show damage.', 'Install PB rope (gossyplure) at 100 per acre. Destroy crop residue after picking.', 'Punjab Agri Dept'),
  (null, 'rice', 'stem_borer',      3, 5.00,  'Spray cartap hydrochloride 50SP at 400 g/acre when 5 percent dead hearts visible at tillering.', 'Release Trichogramma japonicum at 50,000 per acre weekly during vegetative stage.', 'Punjab Agri Dept'),
  (null, 'rice', 'brown_plant_hopper', 3, 0.00, 'Spray buprofezin 25WP at 250 g/acre when 5 to 10 hoppers per hill.', 'Drain field briefly to disturb hoppers. Avoid blanket pyrethroid sprays which trigger resurgence.', 'Punjab Agri Dept')
on conflict do nothing;
