-- Cron + edge function health tracking. Application table so the admin UI
-- (RLS-readable to all authenticated users) can render a single dashboard
-- combining pg_cron and edge function runs.

create table if not exists zameen.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  job_kind text not null check (job_kind in ('pg_cron','edge_function','automation','manual')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running','succeeded','failed','timed_out')) default 'running',
  duration_ms int,
  error_message text,
  records_processed int,
  payload jsonb,
  triggered_by uuid references zameen.users(id)
);

create index if not exists idx_job_runs_name on zameen.job_runs(job_name, started_at desc);
create index if not exists idx_job_runs_status on zameen.job_runs(status, started_at desc)
  where status in ('failed','timed_out');

alter table zameen.job_runs enable row level security;

drop policy if exists "job_runs_authenticated" on zameen.job_runs;
create policy "job_runs_authenticated" on zameen.job_runs
  for select using (auth.role() = 'authenticated');

drop policy if exists "job_runs_service_insert" on zameen.job_runs;
create policy "job_runs_service_insert" on zameen.job_runs
  for insert with check (auth.role() = 'service_role');

drop policy if exists "job_runs_service_update" on zameen.job_runs;
create policy "job_runs_service_update" on zameen.job_runs
  for update using (auth.role() = 'service_role');

-- Bridge pg_cron's cron.job_run_details into zameen.job_runs so the admin
-- dashboard can read a single source of truth.
create or replace function zameen.sync_pg_cron_to_job_runs()
returns trigger
language plpgsql
security definer
as $$
declare
  v_name text;
begin
  select jobname into v_name from cron.job where jobid = new.jobid;
  insert into zameen.job_runs (
    job_name, job_kind, started_at, completed_at, status, duration_ms, error_message
  )
  values (
    coalesce(v_name, 'cron-job-' || new.jobid::text),
    'pg_cron',
    new.start_time,
    new.end_time,
    case new.status when 'succeeded' then 'succeeded' else 'failed' end,
    case
      when new.end_time is null or new.start_time is null then null
      else (extract(epoch from (new.end_time - new.start_time)) * 1000)::int
    end,
    new.return_message
  );
  return new;
exception when others then
  -- never block pg_cron from running
  return new;
end$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'cron' and table_name = 'job_run_details'
  ) then
    execute 'drop trigger if exists pg_cron_sync on cron.job_run_details';
    execute 'create trigger pg_cron_sync
      after insert on cron.job_run_details
      for each row execute function zameen.sync_pg_cron_to_job_runs()';
  end if;
end$$;
