-- Crop loans + repayments for Kissan Card and other agri lenders.

create table if not exists zameen.crop_loans (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  lender_kind text not null check (lender_kind in (
    'kissan_card','agri_bank','commercial_bank','arhti_advance','government_subsidy','private_loan'
  )),
  lender_name text not null,
  loan_number text,
  principal_pkr numeric(14,2) not null,
  interest_rate_pct numeric(5,3),
  disbursement_date date not null,
  maturity_date date,
  collateral_kind text,
  collateral_details text,
  purpose text,
  status text not null check (status in (
    'pending','disbursed','partially_repaid','fully_repaid','defaulted','rescheduled'
  )) default 'pending',
  approval_request_id uuid references zameen.approval_requests(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_loans_entity_status on zameen.crop_loans(entity_id, status);

create table if not exists zameen.crop_loan_transactions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references zameen.crop_loans(id) on delete cascade,
  kind text not null check (kind in ('disbursement','principal_repayment','interest_payment','fee','adjustment')),
  amount_pkr numeric(14,2) not null,
  occurred_on date not null,
  journal_entry_id uuid references zameen.journal_entries(id),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_loan_txn_loan on zameen.crop_loan_transactions(loan_id, occurred_on desc);

alter table zameen.crop_loans enable row level security;
create policy "loans_entity" on zameen.crop_loans for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  with check (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

alter table zameen.crop_loan_transactions enable row level security;
create policy "loan_txn_via_loan" on zameen.crop_loan_transactions for all
  using (exists (
    select 1 from zameen.crop_loans l
    where l.id = loan_id
      and l.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
