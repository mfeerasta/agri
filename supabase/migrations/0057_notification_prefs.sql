-- 0057_notification_prefs.sql
-- Adds a dedicated notification-preferences table on top of the legacy
-- users.notification_prefs jsonb column. This table is what the new
-- settings/notifications UI writes to and what the dispatcher reads.

create table if not exists zameen.notification_preferences (
  user_id uuid primary key references zameen.users(id) on delete cascade,
  channels_enabled jsonb not null default '{"in_app":true,"whatsapp":true,"email":true,"push":true}'::jsonb,
  kinds_disabled text[] not null default '{}',
  quiet_hours_start time,
  quiet_hours_end time,
  digest_mode text not null default 'instant' check (digest_mode in ('instant','hourly','daily_morning','daily_evening')),
  updated_at timestamptz not null default now()
);

alter table zameen.notification_preferences enable row level security;

drop policy if exists "prefs_self" on zameen.notification_preferences;
create policy "prefs_self" on zameen.notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
