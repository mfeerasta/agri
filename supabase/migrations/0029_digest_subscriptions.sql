-- Digest subscriptions: per-entity Slack/email/WhatsApp digests.
-- Driven by the digest-sender Edge Function on a 15-min cron tick.

create table if not exists zameen.digest_subscriptions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  channel text not null check (channel in ('slack', 'email', 'whatsapp')),
  target text not null,
  kind text not null check (kind in ('daily', 'weekly', 'monthly')),
  send_time_local time not null default '07:00',
  timezone text not null default 'Asia/Karachi',
  enabled boolean not null default true,
  last_sent_at timestamptz,
  custom_filters jsonb not null default '{}'::jsonb,
  created_by uuid references zameen.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, channel, target, kind)
);

create index if not exists idx_digest_enabled
  on zameen.digest_subscriptions (enabled, kind, send_time_local)
  where enabled = true;

create index if not exists idx_digest_entity
  on zameen.digest_subscriptions (entity_id);

alter table zameen.digest_subscriptions enable row level security;

drop policy if exists "digest_entity" on zameen.digest_subscriptions;
create policy "digest_entity"
  on zameen.digest_subscriptions
  for all
  using (entity_id in (select auth.user_entities()))
  with check (entity_id in (select auth.user_entities()));

-- Schedule the digest sender every 15 minutes.
select cron.unschedule(j.jobname) from cron.job j
  where j.jobname = 'zameen-digest-sender';

select cron.schedule(
  'zameen-digest-sender',
  '*/15 * * * *',
  $$ select zameen.invoke_edge_function('digest-sender'); $$
);
