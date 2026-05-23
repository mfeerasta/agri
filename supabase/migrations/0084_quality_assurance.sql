-- Quality Assurance: lab tests, grading standards, post-harvest events, complaints

create table if not exists zameen.quality_lab_tests (
  id uuid primary key default gen_random_uuid(),
  produce_lot_id uuid references zameen.produce_lots(id) on delete cascade,
  harvest_record_id uuid,
  test_kind text not null check (test_kind in ('moisture','protein','gluten','foreign_matter','broken_kernels','discoloration','aflatoxin','heavy_metals','pesticide_residue','germination','vigor','seed_purity','grading_standard','other')),
  tested_on date not null,
  laboratory text,
  lab_reference text,
  result_value numeric(14,4),
  result_unit text,
  result_pass_fail text check (result_pass_fail in ('pass','fail','marginal')),
  spec_min numeric(14,4),
  spec_max numeric(14,4),
  report_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_qlt_lot on zameen.quality_lab_tests(produce_lot_id);

create table if not exists zameen.grading_standards (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id) on delete cascade,
  crop_code text not null,
  grade text not null,
  criteria jsonb not null,
  buyer_specific text,
  is_active boolean not null default true,
  unique nulls not distinct (entity_id, crop_code, grade, buyer_specific)
);

create table if not exists zameen.cleaning_drying_events (
  id uuid primary key default gen_random_uuid(),
  produce_lot_id uuid not null references zameen.produce_lots(id) on delete cascade,
  event_kind text not null check (event_kind in ('threshing','cleaning','drying','sorting','grading','bagging','fumigation','treatment')),
  occurred_on date not null,
  input_quantity_kg numeric(14,2),
  output_quantity_kg numeric(14,2),
  shrinkage_kg numeric(14,2),
  shrinkage_pct numeric(5,2),
  cost_pkr numeric(14,2),
  duration_hours numeric(8,2),
  operator_id uuid,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists zameen.quality_complaints (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  related_lot_id uuid references zameen.produce_lots(id),
  related_dispatch_id uuid,
  raised_on date not null,
  raised_by_buyer text not null,
  complaint_kind text check (complaint_kind in ('quality_below_spec','moisture_high','foreign_matter','discoloration','short_weight','wrong_grade','contamination','packaging','other')),
  severity text not null check (severity in ('minor','medium','major','critical')),
  claimed_loss_pkr numeric(14,2),
  resolution text check (resolution in ('replaced','credit_note','discount','rejected','negotiated','dismissed','pending')),
  resolved_pkr numeric(14,2),
  resolved_on date,
  root_cause text,
  corrective_action text,
  approval_request_id uuid,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','investigating','resolved','closed','escalated')),
  created_at timestamptz not null default now()
);

alter table zameen.quality_lab_tests enable row level security;
alter table zameen.grading_standards enable row level security;
alter table zameen.cleaning_drying_events enable row level security;
alter table zameen.quality_complaints enable row level security;

create policy qlt_via_lot on zameen.quality_lab_tests for all using (
  produce_lot_id is null or exists (
    select 1 from zameen.produce_lots l
    where l.id = produce_lot_id and l.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);
create policy gs_entity on zameen.grading_standards for all using (
  entity_id is null or entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);
create policy cde_via_lot on zameen.cleaning_drying_events for all using (
  exists (
    select 1 from zameen.produce_lots l
    where l.id = produce_lot_id and l.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  )
);
create policy qc_entity on zameen.quality_complaints for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);

-- Seed grading standards (entity_id null = global defaults)
insert into zameen.grading_standards (entity_id, crop_code, grade, criteria, buyer_specific, is_active) values
  (null, 'wheat', 'A', '{"moisture_max":12,"foreign_matter_max":1,"broken_kernels_max":2,"discoloration_max":1}'::jsonb, 'PASSCO', true),
  (null, 'wheat', 'B', '{"moisture_max":13,"foreign_matter_max":2,"broken_kernels_max":4,"discoloration_max":3}'::jsonb, 'PASSCO', true),
  (null, 'rice_basmati', 'premium', '{"moisture_max":12,"foreign_matter_max":0.5,"broken_kernels_max":5,"chalky_max":2}'::jsonb, 'PSQCA', true),
  (null, 'rice_basmati', 'medium', '{"moisture_max":13,"foreign_matter_max":1,"broken_kernels_max":15,"chalky_max":6}'::jsonb, 'PSQCA', true),
  (null, 'rice_irri', 'A', '{"moisture_max":13,"foreign_matter_max":1,"broken_kernels_max":10}'::jsonb, 'PSQCA', true),
  (null, 'cotton', 'Mid', '{"staple_length_min_inches":1.0625,"micronaire_min":3.5,"micronaire_max":4.9,"trash_max_pct":3}'::jsonb, 'PCSI', true),
  (null, 'cotton', 'Mid+', '{"staple_length_min_inches":1.09375,"micronaire_min":3.7,"micronaire_max":4.7,"trash_max_pct":2}'::jsonb, 'PCSI', true),
  (null, 'cotton', 'SLM', '{"staple_length_min_inches":1.1875,"micronaire_min":3.8,"micronaire_max":4.6,"trash_max_pct":1.5}'::jsonb, 'PCSI', true)
on conflict do nothing;
