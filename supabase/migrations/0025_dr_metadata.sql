-- DR drill history. Drill writes a row here so MF sees the run in /admin/jobs
-- (via a manual log entry) and a dedicated history table for restore stats.

create table if not exists zameen.dr_drill_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  backup_filename text not null,
  backup_size_mb numeric(10,2),
  restored boolean not null default false,
  smoke_tests_passed boolean,
  smoke_test_failures jsonb,
  duration_seconds int,
  notes text
);

create index if not exists idx_dr_drill_runs_ran_at on zameen.dr_drill_runs(ran_at desc);

alter table zameen.dr_drill_runs enable row level security;

drop policy if exists "dr_drill_runs_authenticated" on zameen.dr_drill_runs;
create policy "dr_drill_runs_authenticated" on zameen.dr_drill_runs
  for select using (auth.role() = 'authenticated');

drop policy if exists "dr_drill_runs_service_insert" on zameen.dr_drill_runs;
create policy "dr_drill_runs_service_insert" on zameen.dr_drill_runs
  for insert with check (auth.role() = 'service_role');
