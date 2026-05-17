-- Phase 2: cron schedules, LISTEN/NOTIFY wiring, audit-log immutability,
-- helper auth functions, and Haazri cross-schema view.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: entity ids accessible to current auth user.
create or replace function auth.user_entities()
returns setof uuid
language sql stable
as $$
  select uer.entity_id
  from zameen.user_entity_roles uer
  join zameen.users u on u.id = uer.user_id
  where u.auth_user_id = auth.uid()
    and uer.is_active = true;
$$;

-- Helper: does the current user hold the named role anywhere?
create or replace function auth.user_has_role(p_role text)
returns boolean
language sql stable
as $$
  select exists (
    select 1
    from zameen.user_entity_roles uer
    join zameen.users u on u.id = uer.user_id
    where u.auth_user_id = auth.uid()
      and uer.role::text = p_role
      and uer.is_active = true
  );
$$;

-- Helper: rank ordering (super_admin=100 ... viewer=10).
create or replace function auth.user_role_at_least(p_role text)
returns boolean
language plpgsql stable
as $$
declare
  required_rank int;
  user_rank int;
begin
  required_rank := case p_role
    when 'super_admin' then 100
    when 'director' then 90
    when 'farm_manager' then 70
    when 'supervisor' then 50
    when 'accountant' then 40
    when 'worker' then 20
    when 'viewer' then 10
    else 0
  end;

  select max(case uer.role::text
    when 'super_admin' then 100
    when 'director' then 90
    when 'farm_manager' then 70
    when 'supervisor' then 50
    when 'accountant' then 40
    when 'worker' then 20
    when 'viewer' then 10
    else 0
  end)
  into user_rank
  from zameen.user_entity_roles uer
  join zameen.users u on u.id = uer.user_id
  where u.auth_user_id = auth.uid() and uer.is_active = true;

  return coalesce(user_rank, 0) >= required_rank;
end;
$$;

-- LISTEN/NOTIFY wiring on approval_requests.
create or replace function zameen.tg_notify_approval_event()
returns trigger
language plpgsql
as $$
begin
  perform pg_notify(
    'approval_events',
    json_build_object(
      'op', tg_op,
      'id', new.id,
      'entity_id', new.entity_id,
      'state', new.state,
      'amount_pkr', new.amount_pkr,
      'approval_type', new.approval_type
    )::text
  );
  return new;
end;
$$;

drop trigger if exists trg_approval_request_notify on zameen.approval_requests;
create trigger trg_approval_request_notify
  after insert or update on zameen.approval_requests
  for each row execute function zameen.tg_notify_approval_event();

-- Audit-log append-only protection.
create or replace function zameen.tg_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only; % is forbidden', tg_op;
end;
$$;

drop trigger if exists trg_audit_log_no_update on zameen.audit_log;
create trigger trg_audit_log_no_update
  before update on zameen.audit_log
  for each row execute function zameen.tg_audit_log_immutable();

drop trigger if exists trg_audit_log_no_delete on zameen.audit_log;
create trigger trg_audit_log_no_delete
  before delete on zameen.audit_log
  for each row execute function zameen.tg_audit_log_immutable();

-- Cross-schema view to Haazri workers. If public.workers is not present locally,
-- the view falls back to an empty result so the planner is happy.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'workers') then
    execute $sql$
      create or replace view zameen.haazri_workers as
      select id::uuid as haazri_worker_id,
             full_name,
             phone,
             cnic_last4
      from public.workers
    $sql$;
  else
    execute $sql$
      create or replace view zameen.haazri_workers as
      select null::uuid as haazri_worker_id,
             null::text as full_name,
             null::text as phone,
             null::text as cnic_last4
      where false
    $sql$;
  end if;
end$$;

-- Helper to invoke an Edge Function via pg_net using the service role JWT
-- injected into the database via `alter database ... set app.service_role_jwt = '...'`.
create or replace function zameen.invoke_edge_function(p_name text, p_payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
as $$
declare
  base_url text := current_setting('app.supabase_url', true);
  jwt text := current_setting('app.service_role_jwt', true);
  request_id bigint;
begin
  if base_url is null or jwt is null then
    raise notice 'app.supabase_url / app.service_role_jwt not configured; skipping invoke';
    return null;
  end if;
  select net.http_post(
    url := base_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || jwt
    ),
    body := p_payload
  ) into request_id;
  return request_id;
end;
$$;

-- Schedule cron jobs. PKT = UTC + 5.
-- 04:00 PKT == 23:00 UTC (previous day).
select cron.unschedule(j.jobname) from cron.job j
  where j.jobname in (
    'zameen-daily-task-generator',
    'zameen-irrigation-reminder',
    'zameen-diesel-anomaly-detector',
    'zameen-approval-escalation',
    'zameen-weather-puller',
    'zameen-field-pl-calculator'
  );

select cron.schedule('zameen-daily-task-generator', '0 23 * * *', $$ select zameen.invoke_edge_function('daily-task-generator'); $$);
select cron.schedule('zameen-irrigation-reminder', '0 1 * * *', $$ select zameen.invoke_edge_function('irrigation-reminder'); $$);
select cron.schedule('zameen-diesel-anomaly-detector', '0 17 * * *', $$ select zameen.invoke_edge_function('diesel-anomaly-detector'); $$);
select cron.schedule('zameen-approval-escalation', '0 * * * *', $$ select zameen.invoke_edge_function('approval-escalation'); $$);
select cron.schedule('zameen-weather-puller', '0 */3 * * *', $$ select zameen.invoke_edge_function('weather-puller'); $$);
select cron.schedule('zameen-field-pl-calculator', '0 21 * * 6', $$ select zameen.invoke_edge_function('field-pl-calculator'); $$);
