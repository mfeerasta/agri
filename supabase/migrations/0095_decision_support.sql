-- Agronomic decision-support: phenology library, observed phenology log,
-- spray-window cache, and persisted nutrient recommendations. Sits above
-- existing scouting, soil-health, and weather modules. No Sentinel or
-- Haazri dependencies. All currency PKR.

create table if not exists zameen.crop_phenology (
  id uuid primary key default gen_random_uuid(),
  crop_code text not null,
  stage_code text not null,
  stage_name text not null,
  stage_name_ur text,
  bbch_code int,
  gdd_from_sowing numeric(8,2),
  days_from_sowing int,
  description text,
  critical_inputs text[],
  recommendations text,
  unique (crop_code, stage_code)
);

create table if not exists zameen.field_phenology_log (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  crop_plan_id uuid,
  observed_stage_code text not null,
  observed_on date not null,
  gdd_accumulated numeric(10,2),
  days_from_sowing int,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_field_phenology_log_field on zameen.field_phenology_log(field_id, observed_on desc);

create table if not exists zameen.spray_windows (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  recommended_for_target text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  score numeric(5,2) not null,
  factors jsonb not null,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_sw_field on zameen.spray_windows(field_id, start_at);

create table if not exists zameen.nutrient_recommendations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  crop_plan_id uuid,
  phenology_stage text,
  computed_on date not null,
  n_kg_per_acre numeric(8,2) not null,
  p2o5_kg_per_acre numeric(8,2) not null,
  k2o_kg_per_acre numeric(8,2) not null,
  micros_jsonb jsonb,
  organic_advice text,
  ai_rationale text,
  ai_rationale_ur text,
  estimated_cost_pkr numeric(12,2),
  alternatives_jsonb jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_nutrient_recs_field on zameen.nutrient_recommendations(field_id, computed_on desc);

alter table zameen.crop_phenology enable row level security;
alter table zameen.field_phenology_log enable row level security;
alter table zameen.spray_windows enable row level security;
alter table zameen.nutrient_recommendations enable row level security;

drop policy if exists "crop_phenology_read_all" on zameen.crop_phenology;
create policy "crop_phenology_read_all" on zameen.crop_phenology for select using (true);

drop policy if exists "field_phenology_log_rw" on zameen.field_phenology_log;
create policy "field_phenology_log_rw" on zameen.field_phenology_log for all using (true) with check (true);

drop policy if exists "spray_windows_rw" on zameen.spray_windows;
create policy "spray_windows_rw" on zameen.spray_windows for all using (true) with check (true);

drop policy if exists "nutrient_recs_rw" on zameen.nutrient_recommendations;
create policy "nutrient_recs_rw" on zameen.nutrient_recommendations for all using (true) with check (true);

-- Seed BBCH-coded growth stages for wheat (12), maize (12), rice (12), cotton (10).
insert into zameen.crop_phenology (crop_code, stage_code, stage_name, stage_name_ur, bbch_code, gdd_from_sowing, days_from_sowing, description, critical_inputs, recommendations) values
  ('wheat','germination','Germination','اگاؤ',9,80,7,'Coleoptile breaks soil surface','{seed_treatment,moisture}','Ensure adequate soil moisture; light irrigation if topsoil dry'),
  ('wheat','seedling','Seedling','بیج کا پودا',13,200,18,'2 to 3 leaves unfolded','{starter_n,weed_scout}','Apply 25% N as DAP/urea band; scout for army worm'),
  ('wheat','tillering','Tillering','شاخیں',23,400,35,'Main shoot plus 2 to 3 tillers','{first_n,p_split,weed_control}','Apply 40% N + full P2O5; spray broadleaf herbicide if needed'),
  ('wheat','stem_extension','Stem extension','گانڈ بنانا',32,650,55,'2 nodes detectable','{second_n,k_split,water}','Apply remaining 35% N; irrigate at jointing'),
  ('wheat','booting','Booting','گابھ',45,900,75,'Flag leaf swollen','{water,fungicide}','Critical water requirement; fungicide for rust if scouted'),
  ('wheat','heading','Heading','بال نکلنا',55,1100,90,'Inflorescence emerging','{water,protect_pollination}','Avoid herbicide; ensure adequate moisture'),
  ('wheat','flowering','Flowering','پھول',65,1300,105,'Anthesis mid-spike','{water,no_spray}','No spray, no irrigation stress, no traffic'),
  ('wheat','milk','Milk stage','دودھیا دانہ',75,1500,115,'Grain milky','{water,aphid_scout}','Watch aphids; final irrigation if dry'),
  ('wheat','dough','Dough stage','نرم دانہ',85,1700,125,'Grain pasty','{ripen}','Stop irrigation 10 days before harvest'),
  ('wheat','maturity','Physiological maturity','پک جانا',89,1900,135,'Black layer at kernel base','{harvest_prep}','Schedule harvester within 7 to 10 days'),
  ('wheat','harvest','Harvest ready','کٹائی',92,2000,140,'Grain moisture under 14%','{harvest}','Harvest now; do not delay past 14 days'),
  ('wheat','post_harvest','Post harvest','کٹائی کے بعد',99,2100,150,'Residue management','{residue_chop,next_season}','Chop or bale straw; plan rabi rotation'),

  ('maize','germination','Germination','اگاؤ',9,70,5,'Emergence visible','{moisture,seed_treatment}','Light irrigation if topsoil dry'),
  ('maize','v2_v4','2 to 4 leaves','2-4 پتے',14,250,15,'Early vegetative','{starter_n,thrips_scout}','25% N; thinning if needed'),
  ('maize','v6','6 leaves','6 پتے',16,450,25,'Whorl visible','{n_topdress,weed_control}','40% N side-dress; final weeding'),
  ('maize','v10','10 leaves','10 پتے',31,750,40,'Stem elongation','{second_n,water}','Remaining 35% N; irrigate at knee-high'),
  ('maize','tasseling','Tasseling','بھٹہ سر',55,1100,55,'Tassel emerging','{water,armyworm}','Critical water; scout fall armyworm'),
  ('maize','silking','Silking','ریشم',65,1250,62,'Silks visible','{water,no_stress}','Avoid water stress; pollination phase'),
  ('maize','blister','Blister','چھالا',71,1450,72,'Kernels watery','{water,k_uptake}','Maintain moisture'),
  ('maize','milk','Milk','دودھیا',75,1650,82,'Kernels milky','{water}','Last irrigation in dry years'),
  ('maize','dough','Dough','نرم',85,1850,92,'Kernels doughy','{ripen}','Stop irrigation'),
  ('maize','dent','Dent','گڑھا',87,2000,100,'Dent at top of kernel','{harvest_prep}','Monitor grain moisture'),
  ('maize','maturity','Physiological maturity','پک',89,2150,108,'Black layer','{harvest}','Harvest at 25 to 30% moisture for grain'),
  ('maize','post_harvest','Post harvest','کٹائی کے بعد',99,2300,115,'Stover management','{residue}','Chop stover or bale for fodder'),

  ('rice','germination','Germination','اگاؤ',9,90,5,'Radicle emergence','{water,seed_soak}','Maintain saturated soil'),
  ('rice','seedling','Seedling','پنیری',13,300,20,'2 to 3 leaves','{starter_n}','25% N at nursery prep'),
  ('rice','transplant','Transplant establishment','منتقلی',15,450,30,'7 to 10 days after transplant','{water,weed}','Standing water 5 cm'),
  ('rice','tillering','Tillering','شاخیں',23,750,45,'Active tillering','{n_topdress,k}','40% N + full K2O'),
  ('rice','max_tiller','Max tillering','زیادہ شاخیں',29,950,55,'Peak tiller count','{water,k}','Drain briefly to control unproductive tillers'),
  ('rice','panicle_init','Panicle initiation','بال شروع',31,1150,65,'Panicle 1 to 2 mm','{second_n,water}','35% N booster; resume flooding'),
  ('rice','booting','Booting','گابھ',45,1350,75,'Flag leaf swollen','{water,no_stress}','Keep 5 cm water'),
  ('rice','heading','Heading','بال',55,1550,85,'Panicle emergence','{water}','No drainage'),
  ('rice','flowering','Flowering','پھول',65,1700,92,'Anthesis','{water,no_spray}','Critical pollination'),
  ('rice','milk','Milk stage','دودھیا',75,1900,102,'Grain milky','{water,bpi_scout}','Watch brown plant hopper'),
  ('rice','dough','Dough','نرم',85,2100,115,'Grain dough','{drain}','Drain field 10 days before harvest'),
  ('rice','maturity','Maturity','پک',89,2300,125,'80% grain golden','{harvest}','Harvest at 20 to 22% moisture'),

  ('cotton','germination','Germination','اگاؤ',9,80,7,'Cotyledons unfolded','{moisture,seed_treatment}','Light pre-irrigation'),
  ('cotton','seedling','Seedling','پودا',12,250,15,'2 to 4 true leaves','{starter_n,thrips_scout}','Watch thrips and jassid'),
  ('cotton','squaring','Squaring','کلیاں',51,600,40,'Squares visible','{n_split,b_micro}','40% N + boron foliar'),
  ('cotton','flowering','Flowering','پھول',61,1000,65,'First white flowers','{water,n_split}','Maintain moisture; 35% N'),
  ('cotton','peak_flower','Peak flowering','پھول عروج',65,1300,80,'Peak flowering','{water,whitefly_scout,k}','K topdress; scout whitefly daily'),
  ('cotton','boll_form','Boll formation','ٹینڈا بننا',71,1500,95,'Bolls 2 to 4 cm','{water,boron}','Critical water phase'),
  ('cotton','boll_fill','Boll filling','ٹینڈا بھرنا',75,1800,115,'Bolls expanding','{water_taper,pgr}','Taper irrigation; consider PGR'),
  ('cotton','boll_open','Boll opening','ٹینڈا کھلنا',85,2100,135,'First open bolls','{defoliant_eval,picking_prep}','Plan first pick'),
  ('cotton','first_pick','First pick','پہلی چنائی',89,2300,150,'30 to 40% bolls open','{labor,storage}','Pick in dry morning hours'),
  ('cotton','final_pick','Final pick','آخری چنائی',92,2500,170,'80%+ bolls open','{labor,close_season}','Final 2 to 3 picks; chop residue')
on conflict (crop_code, stage_code) do nothing;
