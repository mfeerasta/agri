-- Insurance policies + claims for the paper-trail audit.

create table if not exists zameen.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  policy_number text not null,
  insurer_name text not null,
  policy_kind text not null check (policy_kind in ('crop','livestock','asset','liability','health')),
  coverage_pkr numeric(14,2) not null,
  premium_pkr numeric(14,2) not null,
  effective_from date not null,
  effective_to date not null,
  fields_covered uuid[] default '{}',
  animals_covered uuid[] default '{}',
  assets_covered uuid[] default '{}',
  attached_doc_id uuid references zameen.documents(id),
  approval_request_id uuid references zameen.approval_requests(id),
  status text not null check (status in ('active','expired','cancelled')) default 'active',
  created_at timestamptz not null default now()
);
create index if not exists idx_policies_entity_status on zameen.insurance_policies(entity_id, status);

create table if not exists zameen.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references zameen.insurance_policies(id) on delete cascade,
  claim_number text,
  incident_date date not null,
  reported_date date not null default current_date,
  cause text not null,
  affected_field_ids uuid[] default '{}',
  affected_animal_ids uuid[] default '{}',
  estimated_loss_pkr numeric(14,2) not null,
  claimed_pkr numeric(14,2) not null,
  settled_pkr numeric(14,2),
  status text not null check (status in (
    'reported','assessor_pending','assessor_done','approved','rejected','paid','closed'
  )) default 'reported',
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  created_by uuid references zameen.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_claims_policy on zameen.insurance_claims(policy_id, reported_date desc);

alter table zameen.insurance_policies enable row level security;
create policy "policies_entity" on zameen.insurance_policies for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  with check (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

alter table zameen.insurance_claims enable row level security;
create policy "claims_via_policy" on zameen.insurance_claims for all
  using (exists (
    select 1 from zameen.insurance_policies p
    where p.id = policy_id
      and p.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));

-- Extend approval_type enum with 'insurance' so policy issuance and claim approvals route.
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'approval_type' and e.enumlabel = 'insurance') then
    alter type zameen.approval_type add value 'insurance';
  end if;
end$$;
