create table if not exists zameen.bonus_rule_sets (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  name text not null,
  rules jsonb not null,
  is_active boolean not null default true,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now()
);

create table if not exists zameen.worker_bonus_awards (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references zameen.workers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  rule_set_id uuid not null references zameen.bonus_rule_sets(id),
  base_salary_pkr numeric(14,2) not null,
  bonus_breakdown jsonb not null,
  total_bonus_pkr numeric(14,2) not null,
  awarded_at timestamptz not null default now(),
  approval_request_id uuid,
  paid_in_payroll_run_id uuid
);

alter table zameen.bonus_rule_sets enable row level security;
alter table zameen.worker_bonus_awards enable row level security;

create policy brs_entity on zameen.bonus_rule_sets for all
  using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

create policy wba_via_worker on zameen.worker_bonus_awards for all
  using (exists (
    select 1 from zameen.workers w
    where w.id = worker_id and w.entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  ));
