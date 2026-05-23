-- 0073 HR + training + safety module
-- Adds worker documents (extended), training programs, training completions,
-- safety incidents, and PPE issuances. Not linked to Sentinel or Haazri.

-- Worker documents (extend existing simple table if present, else create)
create table if not exists zameen.worker_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references zameen.workers(id) on delete cascade,
  doc_kind text not null check (doc_kind in ('cnic','passport','driver_license','medical_certificate','training_certificate','contract','reference_letter','character_certificate','vaccination_record','other')),
  reference_number text,
  issued_on date,
  expires_on date,
  storage_url text not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table zameen.worker_documents add column if not exists doc_kind text;
alter table zameen.worker_documents add column if not exists reference_number text;
alter table zameen.worker_documents add column if not exists issued_on date;
alter table zameen.worker_documents add column if not exists expires_on date;
alter table zameen.worker_documents add column if not exists storage_url text;
alter table zameen.worker_documents add column if not exists notes text;
create index if not exists idx_wd_worker on zameen.worker_documents(worker_id);
create index if not exists idx_wd_expires on zameen.worker_documents(expires_on) where expires_on is not null;

-- Training programs
create table if not exists zameen.training_programs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  name_ur text,
  category text not null check (category in ('safety','technical','equipment','agronomy','compliance','soft_skills','first_aid','pesticide_handling','machinery_operation')),
  required_for_roles text[] not null default '{}',
  validity_months int,
  passing_score_pct numeric(5,2),
  content_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_tp_entity on zameen.training_programs(entity_id);

-- Training completions
create table if not exists zameen.training_completions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references zameen.training_programs(id) on delete cascade,
  worker_id uuid not null references zameen.workers(id) on delete cascade,
  completed_on date not null,
  score_pct numeric(5,2),
  passed boolean not null default false,
  expires_on date,
  trainer_name text,
  certificate_url text,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_tc_worker_program on zameen.training_completions(worker_id, program_id, completed_on);
create index if not exists idx_tc_worker on zameen.training_completions(worker_id);
create index if not exists idx_tc_expires on zameen.training_completions(expires_on) where expires_on is not null;

-- Safety incidents
create table if not exists zameen.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  occurred_at timestamptz not null,
  reported_by uuid,
  worker_id uuid references zameen.workers(id),
  field_id uuid references zameen.fields(id),
  asset_id uuid references zameen.assets(id),
  severity text not null check (severity in ('near_miss','first_aid','medical_treatment','lost_time','fatality','property_only')),
  category text check (category in ('pesticide_exposure','machinery','heat_stress','fall','animal','electrical','fire','snake_bite','other')),
  description text not null,
  body_part_affected text,
  injury_type text,
  immediate_action_taken text,
  root_cause text,
  corrective_action text,
  corrective_action_due_on date,
  corrective_action_completed_on date,
  medical_attention_required boolean not null default false,
  medical_cost_pkr numeric(14,2),
  lost_days int not null default 0,
  photo_urls jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','investigating','resolved','closed')),
  approval_request_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_safety_entity on zameen.safety_incidents(entity_id, occurred_at desc);
create index if not exists idx_safety_worker on zameen.safety_incidents(worker_id);
create index if not exists idx_safety_status on zameen.safety_incidents(status) where status <> 'closed';

-- PPE issuances
create table if not exists zameen.ppe_issuances (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references zameen.workers(id) on delete cascade,
  ppe_kind text not null check (ppe_kind in ('mask_n95','respirator','goggles','gloves_chemical','gloves_general','overalls','boots','helmet','high_vis_vest','ear_protection','sunscreen','first_aid_kit','other')),
  issued_on date not null,
  quantity int not null default 1,
  expires_on date,
  acknowledgement_signed boolean not null default false,
  cost_pkr numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ppe_worker on zameen.ppe_issuances(worker_id);
create index if not exists idx_ppe_expires on zameen.ppe_issuances(expires_on) where expires_on is not null;

-- RLS
alter table zameen.worker_documents enable row level security;
alter table zameen.training_programs enable row level security;
alter table zameen.training_completions enable row level security;
alter table zameen.safety_incidents enable row level security;
alter table zameen.ppe_issuances enable row level security;

drop policy if exists wd_via_worker on zameen.worker_documents;
create policy wd_via_worker on zameen.worker_documents for all using (
  exists (select 1 from zameen.workers w where w.id = worker_id and w.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
);

drop policy if exists tp2_entity on zameen.training_programs;
create policy tp2_entity on zameen.training_programs for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);

drop policy if exists tc_via_worker on zameen.training_completions;
create policy tc_via_worker on zameen.training_completions for all using (
  exists (select 1 from zameen.workers w where w.id = worker_id and w.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
);

drop policy if exists si_entity on zameen.safety_incidents;
create policy si_entity on zameen.safety_incidents for all using (
  entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);

drop policy if exists ppe_via_worker on zameen.ppe_issuances;
create policy ppe_via_worker on zameen.ppe_issuances for all using (
  exists (select 1 from zameen.workers w where w.id = worker_id and w.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
);

-- Seed standard Pakistan agri training programs for the primary AGRI entity.
insert into zameen.training_programs (entity_id, name, name_ur, category, validity_months)
select e.id, t.name, t.name_ur, t.category, t.validity_months
from zameen.entities e
cross join (values
  ('Pesticide handling and PPE',          'زرعی ادویات اور حفاظتی سامان', 'pesticide_handling',  12),
  ('Tractor operation safety',            'ٹریکٹر چلانے کی حفاظت',         'machinery_operation', 24),
  ('First aid for rural emergencies',     'دیہی ہنگامی ابتدائی طبی امداد', 'first_aid',           12),
  ('Heat stress prevention',              'گرمی سے بچاؤ',                   'safety',               6),
  ('Snake-bite response',                 'سانپ کے کاٹنے کی ابتدائی امداد', 'first_aid',           12),
  ('Crop scouting basics',                'فصل کی نگرانی',                  'agronomy',           null),
  ('Animal handling for dairy and goats', 'دودھ والے جانوروں کی دیکھ بھال', 'technical',           24)
) as t(name, name_ur, category, validity_months)
where e.code = 'AGRI'
  and not exists (
    select 1 from zameen.training_programs tp where tp.entity_id = e.id and tp.name = t.name
  );
