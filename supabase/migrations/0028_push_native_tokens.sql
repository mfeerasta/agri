-- Native push tokens (FCM for Android, APNS-via-FCM for iOS) live alongside
-- the existing web-push subscriptions. Web rows keep working: platform
-- defaults to 'web', endpoint/p256dh/auth become nullable for native rows
-- that only carry a native_token.

alter table zameen.push_subscriptions
  add column if not exists platform text not null default 'web'
    check (platform in ('web', 'ios', 'android'));

alter table zameen.push_subscriptions
  add column if not exists native_token text;

alter table zameen.push_subscriptions alter column endpoint drop not null;
alter table zameen.push_subscriptions alter column p256dh drop not null;
alter table zameen.push_subscriptions alter column auth drop not null;

-- A native row must carry native_token; a web row must carry the web-push triple.
alter table zameen.push_subscriptions
  drop constraint if exists push_subscriptions_platform_payload_chk;

alter table zameen.push_subscriptions
  add constraint push_subscriptions_platform_payload_chk
  check (
    (platform = 'web' and endpoint is not null and p256dh is not null and auth is not null)
    or (platform in ('ios', 'android') and native_token is not null)
  );

create index if not exists idx_push_platform on zameen.push_subscriptions(user_id, platform);
create index if not exists idx_push_native_token on zameen.push_subscriptions(native_token) where native_token is not null;
