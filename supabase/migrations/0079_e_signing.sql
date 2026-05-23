-- E-signing flow: ETO 2002 compliant document signing.
-- Tracks envelopes, signers, immutable audit events, and reusable templates.

create table if not exists zameen.signing_envelopes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  envelope_number text not null,
  title text not null,
  document_kind text not null check (document_kind in (
    'lease_contract','forward_contract','vendor_agreement','employment_contract',
    'board_resolution','power_of_attorney','nda','other'
  )),
  status text not null default 'draft' check (status in (
    'draft','sent','partially_signed','completed','declined','expired','voided'
  )),
  source_record_kind text,
  source_record_id uuid,
  template_id uuid,
  pdf_storage_url text not null,
  pdf_sha256 text not null,
  signed_pdf_url text,
  signed_pdf_sha256 text,
  expires_at timestamptz,
  completed_at timestamptz,
  initiated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_se_entity_num on zameen.signing_envelopes(entity_id, envelope_number);
create index if not exists idx_se_status on zameen.signing_envelopes(entity_id, status);
create index if not exists idx_se_source on zameen.signing_envelopes(source_record_kind, source_record_id);

create table if not exists zameen.envelope_signers (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references zameen.signing_envelopes(id) on delete cascade,
  signing_order int not null,
  signer_name text not null,
  signer_email text,
  signer_phone text,
  signer_cnic text,
  signer_role text not null,
  is_zameen_user boolean not null default false,
  zameen_user_id uuid,
  status text not null default 'pending' check (status in (
    'pending','sent','viewed','signed','declined','expired'
  )),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  access_token text unique,
  ip_address inet,
  user_agent text,
  signature_image_url text,
  consent_text_accepted boolean not null default false,
  identity_verification_method text check (identity_verification_method in (
    'cnic_otp','email_otp','sms_otp','passkey','manual'
  )),
  identity_verified_at timestamptz,
  otp_code_hash text,
  otp_expires_at timestamptz,
  otp_attempts int not null default 0
);
create index if not exists idx_es_envelope on zameen.envelope_signers(envelope_id);
create index if not exists idx_es_status on zameen.envelope_signers(envelope_id, status);

create table if not exists zameen.signature_audit_events (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references zameen.signing_envelopes(id) on delete cascade,
  signer_id uuid references zameen.envelope_signers(id),
  event_kind text not null check (event_kind in (
    'created','sent','viewed','signed','declined','expired','voided','completed',
    'reminder_sent','identity_verified','document_modified'
  )),
  event_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  payload jsonb
);
create index if not exists idx_sae_envelope on zameen.signature_audit_events(envelope_id, event_at desc);

create table if not exists zameen.signing_templates (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references zameen.entities(id),
  name text not null,
  document_kind text not null,
  template_pdf_url text,
  body_html text,
  body_html_ur text,
  variable_schema jsonb,
  default_consent_text text,
  default_consent_text_ur text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_st_entity on zameen.signing_templates(entity_id, document_kind) where is_active = true;

alter table zameen.signing_envelopes enable row level security;
alter table zameen.envelope_signers enable row level security;
alter table zameen.signature_audit_events enable row level security;
alter table zameen.signing_templates enable row level security;

create policy se_entity on zameen.signing_envelopes for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy es_via_env on zameen.envelope_signers for all
  using (exists (select 1 from zameen.signing_envelopes e
    where e.id = envelope_id
      and e.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy sae_via_env on zameen.signature_audit_events for all
  using (exists (select 1 from zameen.signing_envelopes e
    where e.id = envelope_id
      and e.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy st_entity on zameen.signing_templates for all
  using (entity_id is null
    or entity_id in (select zameen.accessible_entity_ids(auth.uid())));
