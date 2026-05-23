-- Live activity stream (denormalized for fast read)
create table if not exists zameen.live_activity (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  actor_role text,
  activity_kind text not null,
  resource_kind text,
  resource_id uuid,
  field_id uuid,
  summary text not null,
  summary_ur text,
  payload jsonb,
  severity text not null default 'info' check (severity in ('info','warn','alert','critical'))
);

create index if not exists idx_la_entity_time on zameen.live_activity(entity_id, occurred_at desc);
create index if not exists idx_la_field on zameen.live_activity(field_id, occurred_at desc) where field_id is not null;

alter table zameen.live_activity enable row level security;

create policy la_entity on zameen.live_activity
  for select using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

-- Add to Supabase Realtime publication
alter publication supabase_realtime add table zameen.live_activity;

-- Trigger function: auto-write live_activity on key event tables
create or replace function zameen.write_live_activity() returns trigger language plpgsql as $$
declare
  e_id uuid;
  f_id uuid;
  summary_text text;
  kind text;
  sev text := 'info';
begin
  if TG_TABLE_NAME = 'input_issuances' then
    select fa.entity_id, f.id into e_id, f_id
      from zameen.fields f
      join zameen.blocks b on b.id = f.block_id
      join zameen.farms fa on fa.id = b.farm_id
      where f.id = NEW.field_id;
    summary_text := 'Input issued: ' || NEW.quantity || ' units';
    kind := 'input_issued';

  elsif TG_TABLE_NAME = 'diesel_daily_logs' then
    e_id := NEW.entity_id;
    f_id := NEW.task_field_id;
    summary_text := 'Diesel log: ' || NEW.diesel_filled_liters || 'L, ' || NEW.hours_run || 'h';
    kind := 'diesel_logged';

  elsif TG_TABLE_NAME = 'harvest_records' then
    select fa.entity_id, f.id into e_id, f_id
      from zameen.harvest_records hr
      join zameen.crop_plans cp on cp.id = hr.crop_plan_id
      join zameen.fields f on f.id = cp.field_id
      join zameen.blocks b on b.id = f.block_id
      join zameen.farms fa on fa.id = b.farm_id
      where hr.id = NEW.id;
    summary_text := 'Harvest recorded: ' || NEW.gross_yield_kg || ' kg';
    kind := 'harvest_logged';

  elsif TG_TABLE_NAME = 'approval_requests' then
    e_id := NEW.entity_id;
    summary_text := 'Approval ' || NEW.state || ': ' || NEW.title;
    kind := 'approval_' || NEW.state;
    if NEW.state = 'rejected' then sev := 'warn'; end if;

  elsif TG_TABLE_NAME = 'safety_incidents' then
    e_id := NEW.entity_id;
    f_id := NEW.field_id;
    summary_text := 'Safety incident (' || NEW.severity || '): ' || coalesce(NEW.category, 'general');
    kind := 'safety_incident';
    if NEW.severity in ('lost_time','fatality') then
      sev := 'critical';
    else
      sev := 'alert';
    end if;
  end if;

  if e_id is not null then
    insert into zameen.live_activity (entity_id, field_id, activity_kind, resource_kind, resource_id, summary, severity)
    values (e_id, f_id, kind, TG_TABLE_NAME, NEW.id, summary_text, sev);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_la_input_issuances on zameen.input_issuances;
create trigger trg_la_input_issuances after insert on zameen.input_issuances
  for each row execute function zameen.write_live_activity();

drop trigger if exists trg_la_diesel on zameen.diesel_daily_logs;
create trigger trg_la_diesel after insert on zameen.diesel_daily_logs
  for each row execute function zameen.write_live_activity();

drop trigger if exists trg_la_harvest on zameen.harvest_records;
create trigger trg_la_harvest after insert on zameen.harvest_records
  for each row execute function zameen.write_live_activity();

drop trigger if exists trg_la_approval on zameen.approval_requests;
create trigger trg_la_approval after insert or update of state on zameen.approval_requests
  for each row execute function zameen.write_live_activity();

drop trigger if exists trg_la_safety on zameen.safety_incidents;
create trigger trg_la_safety after insert on zameen.safety_incidents
  for each row execute function zameen.write_live_activity();

-- Notification fan-out: alert and critical events queue push notifications for ops/director roles.
create or replace function zameen.fanout_live_activity_notifications() returns trigger language plpgsql as $$
declare
  recipient record;
begin
  if NEW.severity not in ('alert','critical') then
    return NEW;
  end if;

  for recipient in
    select u.id from zameen.users u
    where u.entity_id = NEW.entity_id
      and u.role in ('director','ops','manager')
      and u.is_active = true
  loop
    insert into zameen.notifications (recipient_id, entity_id, channel, category, title, body, deep_link, payload)
    values (
      recipient.id,
      NEW.entity_id,
      'push',
      'live_activity',
      case when NEW.severity = 'critical' then 'Critical: ' || NEW.activity_kind else 'Alert: ' || NEW.activity_kind end,
      NEW.summary,
      '/app/dashboard/live',
      jsonb_build_object('liveActivityId', NEW.id, 'resourceKind', NEW.resource_kind, 'resourceId', NEW.resource_id, 'severity', NEW.severity)
    );
  end loop;

  return NEW;
end $$;

drop trigger if exists trg_la_fanout on zameen.live_activity;
create trigger trg_la_fanout after insert on zameen.live_activity
  for each row execute function zameen.fanout_live_activity_notifications();
