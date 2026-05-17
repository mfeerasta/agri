-- Per-user record of completed / skipped product tours. One row per user; arrays of tour ids.
alter table zameen.users add column if not exists tours_completed jsonb not null default '[]'::jsonb;
alter table zameen.users add column if not exists tours_skipped jsonb not null default '[]'::jsonb;
