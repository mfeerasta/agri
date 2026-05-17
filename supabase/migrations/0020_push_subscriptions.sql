-- 0020_push_subscriptions.sql
-- Web Push subscriptions per user per app surface. One row per browser/device.
-- iOS Safari, Android Chrome, desktop browsers each generate a distinct endpoint.

create table if not exists zameen.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zameen.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  app text not null check (app in ('web','field','ops','approve')),
  last_used_at timestamptz,
  failure_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_user_app
  on zameen.push_subscriptions(user_id, app);

alter table zameen.push_subscriptions enable row level security;

create policy "push_self" on zameen.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
