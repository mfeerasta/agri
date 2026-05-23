-- Compliance documents + Pakistan-government-scheme tracker.
-- Lives entirely under zameen.*; no cross-schema links to Sentinel or Haazri.

create table if not exists zameen.compliance_documents (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  doc_kind text not null check (doc_kind in (
    'land_record_fard','khasra_girdawari','registry_deed','intiqal','mutation',
    'water_rate_receipt','abiana_bill','electricity_subsidy_certificate',
    'kissan_card','crop_loan_agreement','crop_insurance_policy','plant_health_certificate',
    'export_phytosanitary','pesticide_dealer_license','tractor_registration',
    'driver_license','nadra_cnic','passport','ntn_certificate','strn_certificate',
    'lease_deed','partnership_deed','board_resolution','power_of_attorney',
    'other'
  )),
  title text not null,
  reference_number text,
  issuing_authority text,
  issued_on date,
  expires_on date,
  related_field_id uuid references zameen.fields(id),
  related_asset_id uuid references zameen.assets(id),
  related_worker_id uuid references zameen.workers(id),
  storage_url text not null,
  notes text,
  status text not null default 'active' check (status in ('active','expired','renewing','superseded','lost')),
  superseded_by_id uuid references zameen.compliance_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_compdoc_expires on zameen.compliance_documents(expires_on) where expires_on is not null;
create index if not exists idx_compdoc_entity on zameen.compliance_documents(entity_id);
create index if not exists idx_compdoc_kind on zameen.compliance_documents(doc_kind);
create index if not exists idx_compdoc_status on zameen.compliance_documents(status);

create table if not exists zameen.government_schemes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  name_ur text,
  authority text not null,
  scheme_type text check (scheme_type in ('subsidy','grant','loan','rebate','insurance','tax_relief','training')),
  description text,
  eligibility_criteria jsonb,
  benefit_summary text,
  application_url text,
  active_from date,
  active_to date,
  is_active boolean not null default true,
  region text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gs_active on zameen.government_schemes(is_active);

create table if not exists zameen.scheme_applications (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  scheme_id uuid not null references zameen.government_schemes(id),
  applied_on date,
  reference_number text,
  applicant_name text,
  status text not null default 'planning' check (status in ('planning','prepared','submitted','under_review','approved','rejected','disbursed','closed')),
  expected_benefit_pkr numeric(14,2),
  actual_benefit_pkr numeric(14,2),
  disbursed_on date,
  notes text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sa_entity on zameen.scheme_applications(entity_id);
create index if not exists idx_sa_scheme on zameen.scheme_applications(scheme_id);
create index if not exists idx_sa_status on zameen.scheme_applications(status);

alter table zameen.compliance_documents enable row level security;
alter table zameen.scheme_applications enable row level security;
alter table zameen.government_schemes enable row level security;

create policy cd_entity on zameen.compliance_documents
  for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy sa_entity on zameen.scheme_applications
  for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy gs_authenticated on zameen.government_schemes
  for select using (auth.role() = 'authenticated');

-- Seed: known active schemes (Punjab + Federal). Codes are stable kebab-case.
insert into zameen.government_schemes (code, name, name_ur, authority, scheme_type, description, benefit_summary, application_url, region, is_active) values
  ('punjab-kissan-card', 'Punjab Kissan Card', 'پنجاب کسان کارڈ', 'Punjab Agriculture Department', 'subsidy', 'Subsidised inputs (fertiliser, seed, pesticide) via Bank of Punjab co-branded card.', 'Up to PKR 150,000 per season per acre for inputs', 'https://kissancard.punjab.gov.pk', 'Punjab', true),
  ('punjab-tubewell-electricity-subsidy', 'Electricity Subsidy for Agriculture Tubewells', 'زرعی ٹیوب ویل بجلی سبسڈی', 'Punjab Energy Department', 'subsidy', 'Concessional tariff for registered agricultural tubewells.', 'Flat PKR 13/kWh ceiling', 'https://energy.punjab.gov.pk', 'Punjab', true),
  ('sbp-crop-loan-insurance', 'Crop Loan Insurance Scheme', 'فصل قرض انشورنس سکیم', 'State Bank of Pakistan', 'insurance', 'Premium subsidy on crop insurance for small farmers borrowing up to PKR 500k.', 'Premium fully subsidised for landholdings up to 25 acres', 'https://www.sbp.org.pk/acd/CLIS.htm', 'Federal', true),
  ('punjab-tractor-subsidy', 'Punjab Tractor Subsidy', 'پنجاب ٹریکٹر سبسڈی', 'Punjab Agriculture Department', 'subsidy', 'Subsidy on locally assembled tractors for registered farmers.', 'PKR 500,000 per tractor (model dependent)', 'https://agripunjab.gov.pk', 'Punjab', true),
  ('bisp-kharif-sahulat', 'BISP Kharif Sahulat Package', 'بی آئی ایس پی خریف سہولت پیکیج', 'Benazir Income Support Programme', 'grant', 'Cash grant package tied to Kharif sowing season for eligible households.', 'PKR 30,000 - 50,000 per eligible household', 'https://bisp.gov.pk', 'Federal', true),
  ('punjab-drip-irrigation-cost-share', 'Drip Irrigation Cost-Sharing', 'ڈرپ آبپاشی لاگت شراکت', 'Punjab Agriculture Department', 'subsidy', 'Cost-sharing on installation of high-efficiency drip irrigation systems.', '60% of installation cost up to PKR 1.2M/acre', 'https://hefp.agripunjab.gov.pk', 'Punjab', true),
  ('punjab-solar-tubewell', 'Solar Tubewell Conversion Subsidy', 'سولر ٹیوب ویل سبسڈی', 'Punjab Energy / Agriculture Department', 'subsidy', 'Conversion of grid/diesel tubewells to solar.', 'Up to 80% capex for ≤15HP systems', 'https://energy.punjab.gov.pk', 'Punjab', true),
  ('ehsaas-rashan', 'Ehsaas Rashan Riayat', 'احساس راشن رعایت', 'Federal Government of Pakistan', 'subsidy', 'Subsidy on essential rashan items for eligible households.', 'PKR 1,000 - 2,000/month per household', 'https://ehsaasrashan.pass.gov.pk', 'Federal', true),
  ('passco-wheat-support-price', 'Wheat Procurement Support Price', 'گندم امدادی قیمت', 'PASSCO', 'subsidy', 'Government procurement of wheat at notified support price.', 'Notified annually; latest PKR 3,900/40kg', 'https://passco.gov.pk', 'Federal', true),
  ('punjab-sugarcane-support-price', 'Sugarcane Support Price', 'گنا امدادی قیمت', 'Punjab Cane Commissioner', 'subsidy', 'Provincial notified support price binding on sugar mills.', 'Notified annually; latest PKR 425/40kg', 'https://canecommissioner.punjab.gov.pk', 'Punjab', true)
on conflict (code) do nothing;
