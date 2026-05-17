-- 0011_notification_indexes.sql
-- Speed up the unread-count bell badge and the WhatsApp webhook lookup that
-- matches Meta message IDs to notification rows.

create index if not exists idx_notifications_recipient_unread
  on zameen.notifications(recipient_id, read_at)
  where read_at is null;

create index if not exists idx_notifications_message_id
  on zameen.notifications((payload->>'messageId'))
  where payload ? 'messageId';
