-- 0077 multi-entity consolidation.
-- Parent-child entity relationships with ownership percentage, intercompany
-- transactions tagged for elimination, and snapshotted consolidation runs that
-- store the consolidated balance sheet, income statement, and cash flow.

create table if not exists zameen.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_entity_id uuid not null references zameen.entities(id) on delete cascade,
  child_entity_id uuid not null references zameen.entities(id) on delete cascade,
  ownership_pct numeric(5,2) not null default 100,
  effective_from date not null,
  effective_to date,
  consolidation_method text not null default 'full' check (consolidation_method in ('full','proportional','equity','cost')),
  unique (parent_entity_id, child_entity_id, effective_from)
);
create index if not exists idx_er_parent on zameen.entity_relationships(parent_entity_id);
create index if not exists idx_er_child on zameen.entity_relationships(child_entity_id);

create table if not exists zameen.intercompany_transactions (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid not null references zameen.entities(id),
  to_entity_id uuid not null references zameen.entities(id),
  transaction_date date not null,
  description text not null,
  amount_pkr numeric(14,2) not null,
  kind text check (kind in ('loan','transfer','sale','service','rent','allocation','dividend','other')),
  from_journal_entry_id uuid,
  to_journal_entry_id uuid,
  elimination_status text not null default 'pending' check (elimination_status in ('pending','reconciled','eliminated','disputed')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ic_from on zameen.intercompany_transactions(from_entity_id, transaction_date);
create index if not exists idx_ic_to on zameen.intercompany_transactions(to_entity_id, transaction_date);
create index if not exists idx_ic_status on zameen.intercompany_transactions(elimination_status);

create table if not exists zameen.consolidation_runs (
  id uuid primary key default gen_random_uuid(),
  parent_entity_id uuid not null references zameen.entities(id),
  period_start date not null,
  period_end date not null,
  consolidated_at timestamptz not null default now(),
  consolidated_by uuid,
  balance_sheet_snapshot jsonb,
  income_statement_snapshot jsonb,
  cash_flow_snapshot jsonb,
  eliminations_applied jsonb not null default '[]'::jsonb,
  child_entities uuid[] not null,
  status text not null default 'draft' check (status in ('draft','final','superseded')),
  notes text
);
create index if not exists idx_cr_parent on zameen.consolidation_runs(parent_entity_id, period_end desc);
create index if not exists idx_cr_status on zameen.consolidation_runs(status);

alter table zameen.entity_relationships enable row level security;
alter table zameen.intercompany_transactions enable row level security;
alter table zameen.consolidation_runs enable row level security;

create policy er_entity on zameen.entity_relationships for select using (
  parent_entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  or child_entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);
create policy ic_entity on zameen.intercompany_transactions for all using (
  from_entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  or to_entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);
create policy cr_entity on zameen.consolidation_runs for all using (
  parent_entity_id in (select zameen.accessible_entity_ids(auth.uid()))
);
