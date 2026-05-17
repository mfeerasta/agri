-- PostgREST RPC surface and the field_pnl_cache table consumed by
-- the field-pl-calculator edge function.

create schema if not exists rpc;
grant usage on schema rpc to authenticated, service_role;

create table if not exists zameen.field_pnl_cache (
  field_id uuid not null,
  season_label varchar(32) not null,
  crop_plan_id uuid not null,
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  variety_name text,
  acres numeric(12, 4) not null,
  revenue_pkr numeric(14, 2) not null,
  total_cost_pkr numeric(14, 2) not null,
  cost_by_pool jsonb not null default '{}'::jsonb,
  gross_margin_pkr numeric(14, 2) not null,
  margin_per_acre_pkr numeric(14, 2) not null,
  yield_kg numeric(14, 2) not null default 0,
  yield_per_acre_kg numeric(14, 2) not null default 0,
  computed_at timestamptz not null default now(),
  primary key (field_id, season_label)
);
alter table zameen.field_pnl_cache enable row level security;
drop policy if exists field_pnl_cache_select on zameen.field_pnl_cache;
create policy field_pnl_cache_select on zameen.field_pnl_cache
  for select using (entity_id in (select auth.user_entities()));

-- rpc.submit_approval(request jsonb) -> uuid
create or replace function rpc.submit_approval(request jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_id uuid;
  caller_user_id uuid;
begin
  select u.id into caller_user_id from zameen.users u where u.auth_user_id = auth.uid();
  if caller_user_id is null then
    raise exception 'caller has no zameen.users row';
  end if;

  insert into zameen.approval_requests (
    entity_id, approval_type, source_module, source_record_id, title, title_ur,
    amount_pkr, payload, context_snapshot, requested_by, state, submitted_at
  )
  values (
    (request->>'entity_id')::uuid,
    (request->>'approval_type')::zameen.approval_type,
    request->>'source_module',
    nullif(request->>'source_record_id', '')::uuid,
    request->>'title',
    request->>'title_ur',
    nullif(request->>'amount_pkr', '')::numeric,
    coalesce(request->'payload', '{}'::jsonb),
    request->'context_snapshot',
    caller_user_id,
    'submitted',
    now()
  )
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function rpc.submit_approval(jsonb) to authenticated;

-- rpc.act_on_approval(request_id uuid, action text, comment text) -> approval_requests
create or replace function rpc.act_on_approval(p_request_id uuid, p_action text, p_comment text)
returns zameen.approval_requests
language plpgsql
security invoker
as $$
declare
  before_row zameen.approval_requests;
  after_state zameen.approval_state;
  caller_user_id uuid;
  caller_role text;
begin
  select u.id into caller_user_id from zameen.users u where u.auth_user_id = auth.uid();
  if caller_user_id is null then
    raise exception 'caller has no zameen.users row';
  end if;
  select uer.role::text into caller_role
    from zameen.user_entity_roles uer
    where uer.user_id = caller_user_id and uer.is_active = true
    order by case uer.role::text
      when 'super_admin' then 100
      when 'director' then 90
      when 'farm_manager' then 70
      when 'supervisor' then 50
      else 0 end desc
    limit 1;

  select * into before_row from zameen.approval_requests where id = p_request_id;
  if before_row.id is null then raise exception 'approval not found'; end if;

  after_state := case p_action
    when 'approve' then 'approved'::zameen.approval_state
    when 'reject' then 'rejected'::zameen.approval_state
    when 'send_back' then 'sent_back'::zameen.approval_state
    when 'execute' then 'executed'::zameen.approval_state
    when 'reverse' then 'closed'::zameen.approval_state
    when 'comment' then before_row.state
    else before_row.state
  end;

  insert into zameen.approval_actions(
    approval_request_id, action, actor_id, actor_role, from_state, to_state, comment
  ) values (
    p_request_id, p_action::zameen.approval_action, caller_user_id,
    coalesce(caller_role, 'viewer'), before_row.state, after_state, p_comment
  );

  update zameen.approval_requests
  set state = after_state,
      decided_at = case when p_action in ('approve','reject','send_back') then now() else decided_at end,
      executed_at = case when p_action = 'execute' then now() else executed_at end,
      reversed_at = case when p_action = 'reverse' then now() else reversed_at end,
      reversed_by = case when p_action = 'reverse' then caller_user_id else reversed_by end,
      updated_at = now()
  where id = p_request_id
  returning * into before_row;

  return before_row;
end;
$$;
grant execute on function rpc.act_on_approval(uuid, text, text) to authenticated;

-- rpc.allocate_input_to_field(issuance jsonb) -> uuid
create or replace function rpc.allocate_input_to_field(issuance jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_id uuid;
  qty numeric := (issuance->>'quantity')::numeric;
  unit_cost numeric := (issuance->>'unit_cost_pkr')::numeric;
begin
  insert into zameen.input_issuances(
    input_id, field_id, crop_plan_id, issued_on, quantity, unit_cost_pkr,
    total_cost_pkr, issued_to, received_by, purpose
  )
  values (
    (issuance->>'input_id')::uuid,
    nullif(issuance->>'field_id', '')::uuid,
    nullif(issuance->>'crop_plan_id', '')::uuid,
    coalesce((issuance->>'issued_on')::timestamptz, now()),
    qty, unit_cost, qty * unit_cost,
    nullif(issuance->>'issued_to', '')::uuid,
    nullif(issuance->>'received_by', '')::uuid,
    issuance->>'purpose'
  )
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function rpc.allocate_input_to_field(jsonb) to authenticated;

-- rpc.log_diesel_daily(entry jsonb) -> uuid
create or replace function rpc.log_diesel_daily(entry jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_id uuid;
  hours numeric := (entry->>'hour_meter_end')::numeric - (entry->>'hour_meter_start')::numeric;
  litres numeric := (entry->>'diesel_filled_liters')::numeric;
  rate numeric := (entry->>'rate_liter_pkr')::numeric;
begin
  insert into zameen.diesel_daily_logs(
    entity_id, asset_id, log_date, operator_name, hour_meter_start, hour_meter_end,
    hours_run, diesel_filled_liters, rate_liter_pkr, total_cost_pkr, source_tank_id,
    task_field_id, task_kind, task_notes, receipt_photo_urls
  )
  values (
    (entry->>'entity_id')::uuid,
    (entry->>'asset_id')::uuid,
    (entry->>'log_date')::date,
    entry->>'operator_name',
    (entry->>'hour_meter_start')::numeric,
    (entry->>'hour_meter_end')::numeric,
    hours, litres, rate, litres * rate,
    nullif(entry->>'source_tank_id', '')::uuid,
    nullif(entry->>'task_field_id', '')::uuid,
    entry->>'task_kind',
    entry->>'task_notes',
    coalesce(entry->'receipt_photo_urls', '[]'::jsonb)
  )
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function rpc.log_diesel_daily(jsonb) to authenticated;

-- rpc.compute_field_pl(field_id uuid, season_label text) -> jsonb
create or replace function rpc.compute_field_pl(p_field_id uuid, p_season_label text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  result jsonb;
begin
  select to_jsonb(c) into result
  from zameen.field_pnl_cache c
  where c.field_id = p_field_id and c.season_label = p_season_label;
  return coalesce(result, '{}'::jsonb);
end;
$$;
grant execute on function rpc.compute_field_pl(uuid, text) to authenticated;
