-- 0094 bank integration
-- Adds SBP digital banking integration: bank accounts, statement imports,
-- reconciliation queue, and payment orders that route through the existing
-- approval engine. PKR only, schema isolated under zameen.

alter type zameen.approval_type add value if not exists 'bank_payment';

create table if not exists zameen.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  iban text,
  account_title text not null,
  branch_code text,
  branch_name text,
  account_kind text not null check (account_kind in ('current','saving','deposit','islamic_current','islamic_saving','agri_loan','operating')),
  currency text not null default 'PKR',
  signatories jsonb,
  opening_balance_pkr numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_ba_entity_acct on zameen.bank_accounts(entity_id, account_number);

create table if not exists zameen.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references zameen.bank_accounts(id) on delete cascade,
  transaction_date date not null,
  value_date date,
  amount_pkr numeric(14,2) not null,
  direction text not null check (direction in ('debit','credit')),
  description text not null,
  counterparty text,
  counterparty_account text,
  reference_number text,
  bank_reference text,
  category text,
  matched_to_kind text check (matched_to_kind in ('journal_entry','ar_receipt','ap_payment','loan_disbursement','loan_payment','tax_payment','salary','manual')),
  matched_to_id uuid,
  matched_at timestamptz,
  matched_by uuid,
  status text not null default 'unreconciled' check (status in ('unreconciled','matched','flagged','manual_reviewed')),
  raw_jsonb jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_bt_account_date on zameen.bank_transactions(account_id, transaction_date desc);
create index if not exists idx_bt_status on zameen.bank_transactions(status);

create table if not exists zameen.bank_statements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references zameen.bank_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  opening_balance_pkr numeric(14,2) not null,
  closing_balance_pkr numeric(14,2) not null,
  total_credits_pkr numeric(14,2) not null,
  total_debits_pkr numeric(14,2) not null,
  transaction_count int not null,
  statement_url text,
  imported_at timestamptz not null default now(),
  imported_by uuid,
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','in_progress','reconciled','disputed'))
);

create table if not exists zameen.payment_orders (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  from_account_id uuid not null references zameen.bank_accounts(id),
  payee_name text not null,
  payee_account text,
  payee_iban text,
  payee_bank text,
  payee_cnic text,
  amount_pkr numeric(14,2) not null,
  payment_kind text not null check (payment_kind in ('vendor_payment','salary','tax','loan_repayment','utility','rent','refund','other')),
  related_invoice_id uuid,
  related_payroll_run_id uuid,
  scheduled_for date,
  executed_on date,
  bank_reference text,
  approval_request_id uuid,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','queued','executing','executed','failed','cancelled')),
  failure_reason text,
  ifrac_token text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table zameen.bank_accounts enable row level security;
alter table zameen.bank_transactions enable row level security;
alter table zameen.bank_statements enable row level security;
alter table zameen.payment_orders enable row level security;

create policy ba_entity on zameen.bank_accounts for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy bt_via_acct on zameen.bank_transactions for all using (exists (select 1 from zameen.bank_accounts a where a.id = account_id and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy bs_via_acct on zameen.bank_statements for all using (exists (select 1 from zameen.bank_accounts a where a.id = account_id and a.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));
create policy po_entity on zameen.payment_orders for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
