-- 0038_worker_scoring.sql
-- Worker leaderboard + bonus scheme tables for Zameen.
-- Stores monthly composite scores per worker plus configurable bonus rules.

create table if not exists zameen.worker_score_periods (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  worker_id uuid not null references zameen.workers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  days_present int not null default 0,
  days_absent int not null default 0,
  days_late int not null default 0,
  tasks_completed int not null default 0,
  tasks_late int not null default 0,
  piece_rate_units numeric(14,4) not null default 0,
  piece_rate_total_pkr numeric(14,2) not null default 0,
  diesel_anomalies_associated int not null default 0,
  composite_score numeric(8,4) not null default 0,
  rank_in_period int,
  bonus_eligible boolean not null default false,
  bonus_amount_pkr numeric(14,2) default 0,
  bonus_payslip_id uuid,
  computed_at timestamptz not null default now(),
  unique (worker_id, period_start, period_end)
);

create index if not exists idx_scores_period
  on zameen.worker_score_periods(entity_id, period_start desc, rank_in_period);

create table if not exists zameen.bonus_rules (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  period_kind text not null check (period_kind in ('weekly','monthly','seasonal','annual')) default 'monthly',
  formula jsonb not null,
  min_score numeric(8,4) not null default 0,
  amount_kind text not null check (amount_kind in ('flat','percent_of_base','percent_of_piece_rate','top_n')) default 'flat',
  amount_value numeric(14,2) not null,
  top_n int,
  created_at timestamptz not null default now()
);

alter table zameen.worker_score_periods enable row level security;
create policy "scores_entity" on zameen.worker_score_periods for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  with check (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

alter table zameen.bonus_rules enable row level security;
create policy "bonus_rules_entity" on zameen.bonus_rules for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())))
  with check (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
