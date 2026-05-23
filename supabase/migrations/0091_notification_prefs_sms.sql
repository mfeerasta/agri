-- 0091_notification_prefs_sms.sql
-- Extend notification preferences to cover SMS delivery and the
-- recipient's preferred body language. sms_phone is captured at worker
-- profile creation so SMS works even before a worker logs into the
-- Field PWA.

alter table zameen.notification_preferences
  add column if not exists sms_enabled boolean not null default false;

alter table zameen.notification_preferences
  add column if not exists preferred_language text default 'ur'
    check (preferred_language in ('en','ur','roman_ur','pa','hi'));

alter table zameen.notification_preferences
  add column if not exists sms_phone text;

-- When the PWA has not loaded in 7 days we treat the worker as offline
-- and the dispatcher will fall back to SMS automatically.
alter table zameen.notification_preferences
  add column if not exists last_pwa_seen_at timestamptz;
