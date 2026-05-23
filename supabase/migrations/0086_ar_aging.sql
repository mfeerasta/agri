-- AR aging, buyer credit limits, and dispute management.
-- Mandi arhtis and contract buyers often pay 30/60/90 days post-delivery.
-- All amounts PKR. Photo / evidence URLs for disputes only.

create table if not exists zameen.ar_invoices (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  buyer_id uuid not null,
  invoice_number text not null,
  invoice_date date not null,
  due_date date not null,
  sales_dispatch_id uuid,
  delivery_id uuid,
  forward_contract_id uuid,
  description text,
  amount_pkr numeric(14,2) not null,
  tax_pkr numeric(14,2) not null default 0,
  discount_pkr numeric(14,2) not null default 0,
  total_pkr numeric(14,2) not null,
  paid_pkr numeric(14,2) not null default 0,
  outstanding_pkr numeric(14,2) not null,
  status text not null default 'open' check (status in ('open','partial','paid','overdue','disputed','written_off','void')),
  payment_terms_days int,
  invoice_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_ar_entity_inv on zameen.ar_invoices(entity_id, invoice_number);
create index if not exists idx_ar_buyer on zameen.ar_invoices(buyer_id, status);
create index if not exists idx_ar_due on zameen.ar_invoices(due_date) where status in ('open','partial','overdue');

create table if not exists zameen.ar_receipts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references zameen.ar_invoices(id) on delete cascade,
  received_on date not null,
  amount_pkr numeric(14,2) not null,
  method text not null check (method in ('cash','cheque','bank_transfer','online','adjustment','barter')),
  reference_number text,
  bank_name text,
  cleared_on date,
  journal_entry_id uuid,
  approval_request_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_arr_invoice on zameen.ar_receipts(invoice_id, received_on desc);

create table if not exists zameen.buyer_credit_limits (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  credit_limit_pkr numeric(14,2) not null,
  payment_terms_days int not null default 30,
  early_payment_discount_pct numeric(5,2),
  late_fee_pct_per_month numeric(5,2),
  effective_from date not null,
  effective_to date,
  approved_by uuid,
  approval_request_id uuid,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_bcl_buyer on zameen.buyer_credit_limits(buyer_id, is_active);

create table if not exists zameen.ar_disputes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references zameen.ar_invoices(id) on delete cascade,
  raised_on date not null,
  raised_by_buyer text,
  dispute_kind text check (dispute_kind in ('quantity_short','quality_issue','wrong_amount','duplicate_billing','already_paid','contract_breach','other')),
  disputed_amount_pkr numeric(14,2),
  description text,
  evidence_urls jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','investigating','negotiating','resolved','escalated_to_legal','withdrawn','written_off')),
  resolution text,
  resolution_amount_pkr numeric(14,2),
  resolved_on date,
  resolved_by uuid,
  approval_request_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ard_invoice on zameen.ar_disputes(invoice_id, status);

alter table zameen.ar_invoices enable row level security;
alter table zameen.ar_receipts enable row level security;
alter table zameen.buyer_credit_limits enable row level security;
alter table zameen.ar_disputes enable row level security;

create policy ari_entity on zameen.ar_invoices for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy arr_via_inv on zameen.ar_receipts for all using (exists (select 1 from zameen.ar_invoices i where i.id = invoice_id and i.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy bcl_entity on zameen.buyer_credit_limits for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy ard_via_inv on zameen.ar_disputes for all using (exists (select 1 from zameen.ar_invoices i where i.id = invoice_id and i.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));

-- Daily AR aging cron: flips overdue, fires reminders. 09:00 PKT == 04:00 UTC.
select cron.unschedule(j.jobname) from cron.job j where j.jobname = 'zameen-ar-aging-checker';
select cron.schedule(
  'zameen-ar-aging-checker',
  '0 4 * * *',
  $$ select zameen.invoke_edge_function('ar-aging-checker'); $$
);
