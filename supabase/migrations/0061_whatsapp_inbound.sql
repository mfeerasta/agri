-- WhatsApp inbound messages and delivery-tracking column.
--
-- Used by:
--   supabase/functions/notify-whatsapp                 (outbound dispatch)
--   supabase/functions/notify-whatsapp/inbound-webhook (status + inbound)

alter table zameen.notifications
  add column if not exists delivered_at timestamptz;

create table if not exists zameen.whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text unique not null,
  from_phone text not null,
  body text,
  media_url text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  matched_user_id uuid references zameen.users(id),
  nlu_intent text,
  nlu_payload jsonb,
  reply_sent_at timestamptz
);

create index if not exists idx_wa_inbound_unprocessed
  on zameen.whatsapp_inbound_messages(received_at)
  where processed_at is null;

create index if not exists idx_wa_inbound_user
  on zameen.whatsapp_inbound_messages(matched_user_id, received_at desc)
  where matched_user_id is not null;

alter table zameen.whatsapp_inbound_messages enable row level security;

create policy wa_inbound_service_role
  on zameen.whatsapp_inbound_messages
  for all
  to service_role
  using (true)
  with check (true);

-- Cron schedules for the dedicated WhatsApp dispatcher.
-- Pakistan Standard Time is UTC+5, no DST. Work hours 06:00-22:00 PKT
-- correspond to 01:00-17:00 UTC. pg_cron's minimum resolution is one
-- minute, so we run every minute during work hours and every five
-- minutes outside that window.
do $$
begin
  perform 1 from cron.job where jobname = 'zameen-notify-whatsapp-workhours';
  if found then
    perform cron.unschedule('zameen-notify-whatsapp-workhours');
  end if;
  perform 1 from cron.job where jobname = 'zameen-notify-whatsapp-offhours';
  if found then
    perform cron.unschedule('zameen-notify-whatsapp-offhours');
  end if;
end$$;

select cron.schedule(
  'zameen-notify-whatsapp-workhours',
  '* 1-17 * * *',
  $$ select zameen.invoke_edge_function('notify-whatsapp'); $$
);
select cron.schedule(
  'zameen-notify-whatsapp-offhours',
  '*/5 0,18-23 * * *',
  $$ select zameen.invoke_edge_function('notify-whatsapp'); $$
);
