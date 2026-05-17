-- 0021_notification_prefs.sql
-- Per-user channel preferences for each notification event. Stored as JSONB so
-- the schema can evolve (new event types) without a migration. Channels are
-- a subset of: in_app, whatsapp, push, email.

alter table zameen.users
  add column if not exists notification_prefs jsonb not null default '{
    "approvalSubmitted": ["in_app","whatsapp","push"],
    "approvalDecided": ["in_app","whatsapp","push"],
    "mention": ["in_app","push"],
    "anomalyDetected": ["in_app","push"],
    "escalationReminder": ["in_app","whatsapp","push","email"]
  }'::jsonb;
