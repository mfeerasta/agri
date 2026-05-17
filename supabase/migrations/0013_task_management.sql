-- Task management primitives: subtasks, dependencies, time tracking, comments,
-- activity stream, labels, saved views. Idempotent.

-- Subtasks + monday-style task columns on the existing tasks table.
alter table zameen.tasks add column if not exists parent_task_id uuid references zameen.tasks(id) on delete cascade;
alter table zameen.tasks add column if not exists task_order int not null default 0;
alter table zameen.tasks add column if not exists due_date date;
alter table zameen.tasks add column if not exists priority text check (priority in ('low','medium','high','urgent')) default 'medium';
alter table zameen.tasks add column if not exists label_color text check (label_color in ('blue','green','yellow','orange','red','purple','gray')) default 'gray';
alter table zameen.tasks add column if not exists labels text[] not null default '{}';
alter table zameen.tasks add column if not exists attachments jsonb not null default '[]'::jsonb;
create index if not exists idx_tasks_parent on zameen.tasks(parent_task_id);
create index if not exists idx_tasks_due on zameen.tasks(due_date) where status in ('open','in_progress');

-- Task dependencies: A must complete before B.
create table if not exists zameen.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  blocker_task_id uuid not null references zameen.tasks(id) on delete cascade,
  blocked_task_id uuid not null references zameen.tasks(id) on delete cascade,
  kind text not null check (kind in ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')) default 'finish_to_start',
  created_at timestamptz not null default now(),
  unique (blocker_task_id, blocked_task_id)
);
create index if not exists idx_deps_blocker on zameen.task_dependencies(blocker_task_id);
create index if not exists idx_deps_blocked on zameen.task_dependencies(blocked_task_id);

-- Time tracking: workers log hours against tasks.
create table if not exists zameen.task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references zameen.tasks(id) on delete cascade,
  worker_id uuid not null references zameen.workers(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_time_task on zameen.task_time_entries(task_id);
create index if not exists idx_time_worker on zameen.task_time_entries(worker_id, started_at desc);

-- Generic comments + mentions for tasks, approvals, repairs, crop plans, feasibility.
create table if not exists zameen.entity_comments (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null check (entity_kind in ('task','approval','repair','crop_plan','feasibility')),
  entity_id uuid not null,
  parent_comment_id uuid references zameen.entity_comments(id) on delete cascade,
  author_id uuid not null references zameen.users(id),
  body text not null,
  body_ur text,
  mentions uuid[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_entity on zameen.entity_comments(entity_kind, entity_id, created_at desc);
create index if not exists idx_comments_mentions on zameen.entity_comments using gin(mentions);

-- Activity log: monday-style stream per entity. Append-only.
create table if not exists zameen.entity_activity (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null,
  entity_id uuid not null,
  actor_id uuid references zameen.users(id),
  verb text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_activity_entity on zameen.entity_activity(entity_kind, entity_id, occurred_at desc);

-- Custom labels per entity type.
create table if not exists zameen.entity_labels (
  id uuid primary key default gen_random_uuid(),
  entity_id_text text not null,
  scope text not null check (scope in ('task','crop_plan','repair','approval')),
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (scope, name)
);

-- Saved views: persisted filter + grouping + view-mode for any module.
create table if not exists zameen.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zameen.users(id) on delete cascade,
  scope text not null,
  name text not null,
  view_mode text not null check (view_mode in ('table','kanban','gantt','calendar','workload','chart','map')),
  config jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_views_user on zameen.saved_views(user_id, scope);
