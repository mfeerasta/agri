-- Farm visitors, biosecurity protocols, disease outbreaks, quarantine.
-- No links to Sentinel or Haazri.

create table if not exists zameen.visitors (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  visitor_name text not null,
  cnic text,
  phone text,
  organization text,
  vehicle_registration text,
  visit_purpose text not null check (visit_purpose in ('inspection','vendor_meeting','vendor_delivery','vet_visit','buyer','contractor','researcher','training','tour','government','family','other')),
  signed_in_at timestamptz not null default now(),
  signed_out_at timestamptz,
  escorted_by uuid,
  fields_visited uuid[],
  livestock_areas_visited boolean not null default false,
  biosecurity_check_passed boolean not null default false,
  biosecurity_failures text[],
  photo_id_url text,
  signature_url text,
  health_declaration_signed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_vis_entity on zameen.visitors(entity_id, signed_in_at desc);

create table if not exists zameen.biosecurity_protocols (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  zone text not null check (zone in ('livestock','poultry','dairy','crop','storage','equipment','perimeter')),
  protocol_name text not null,
  protocol_kind text not null check (protocol_kind in ('disinfection','quarantine','vaccination_required','clothing_change','footbath','vehicle_wash','traffic_restriction','isolation_period','health_certification')),
  description text,
  enforcement_level text not null check (enforcement_level in ('mandatory','recommended','seasonal','conditional')),
  applies_to text[] not null default '{visitors,workers,vehicles}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists zameen.disease_outbreaks (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  outbreak_kind text not null check (outbreak_kind in ('fmd','lsd','brucellosis','mastitis','avian_flu','newcastle','ppr','anthrax','clostridial','crop_blight','rust','locust','other')),
  detected_on date not null,
  affected_area text,
  affected_animal_ids uuid[],
  affected_field_ids uuid[],
  source_suspected text,
  containment_zone_polygon jsonb,
  containment_started_on date,
  containment_ended_on date,
  total_affected_count int,
  total_lost_count int,
  total_treatment_cost_pkr numeric(14,2),
  status text not null default 'active' check (status in ('suspected','active','contained','resolved','false_alarm')),
  reported_to_authority text,
  authority_reference text,
  approval_request_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists zameen.quarantine_records (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('animal','herd','field','equipment','vehicle','area')),
  subject_id uuid,
  reason text not null,
  related_outbreak_id uuid references zameen.disease_outbreaks(id),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','released','escalated')),
  daily_observation_required boolean not null default true,
  released_by uuid,
  release_notes text,
  created_at timestamptz not null default now()
);

alter table zameen.visitors enable row level security;
alter table zameen.biosecurity_protocols enable row level security;
alter table zameen.disease_outbreaks enable row level security;
alter table zameen.quarantine_records enable row level security;
create policy v_entity on zameen.visitors for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy bp_entity on zameen.biosecurity_protocols for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy do_entity on zameen.disease_outbreaks for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy qr_entity on zameen.quarantine_records for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
