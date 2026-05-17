-- Crop disease photo diagnostics. Stores Claude-vision (or fallback) inferred
-- diagnoses for field photos, with treatment suggestions, severity, and a
-- bilingual (en + ur) suggestion text used by the field PWA. Status follows
-- pending_review -> confirmed/dismissed -> treated -> resolved.

create table if not exists zameen.crop_diagnostics (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references zameen.fields(id) on delete cascade,
  crop_plan_id uuid references zameen.crop_plans(id) on delete set null,
  stage_log_id uuid references zameen.crop_stage_logs(id) on delete set null,
  photo_url text not null,
  observed_on date not null,
  reported_by uuid references zameen.users(id),
  diagnosis_label text,
  confidence numeric(5,4),
  severity text check (severity in ('mild','moderate','severe','unknown')),
  treatment_suggestion text,
  treatment_suggestion_ur text,
  alternative_diagnoses jsonb not null default '[]'::jsonb,
  source text not null check (source in ('claude_vision','gpt_vision','expert_override','plant_id_api')) default 'claude_vision',
  status text not null check (status in ('pending_review','confirmed','dismissed','treated','resolved')) default 'pending_review',
  reviewed_by uuid references zameen.users(id),
  reviewed_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_diag_field on zameen.crop_diagnostics(field_id, observed_on desc);
create index if not exists idx_diag_status on zameen.crop_diagnostics(status, observed_on desc) where status = 'pending_review';
create index if not exists idx_diag_crop_plan on zameen.crop_diagnostics(crop_plan_id, observed_on desc);
create index if not exists idx_diag_stage_log on zameen.crop_diagnostics(stage_log_id);

alter table zameen.crop_diagnostics enable row level security;

create policy "diag_via_field" on zameen.crop_diagnostics for all
  using (exists (
    select 1 from zameen.fields f
    join zameen.blocks b on b.id = f.block_id
    join zameen.farms fa on fa.id = b.farm_id
    where f.id = field_id and fa.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
