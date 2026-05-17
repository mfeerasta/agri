-- RLS for the task management primitives added in 0013.

alter table zameen.task_dependencies enable row level security;
drop policy if exists "deps_via_task" on zameen.task_dependencies;
create policy "deps_via_task" on zameen.task_dependencies for all
  using (exists (select 1 from zameen.tasks t where t.id = blocker_task_id and t.entity_id in (select zameen.accessible_entity_ids(auth.uid()))))
  with check (exists (select 1 from zameen.tasks t where t.id = blocker_task_id and t.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));

alter table zameen.task_time_entries enable row level security;
drop policy if exists "time_via_task" on zameen.task_time_entries;
create policy "time_via_task" on zameen.task_time_entries for all
  using (exists (select 1 from zameen.tasks t where t.id = task_id and t.entity_id in (select zameen.accessible_entity_ids(auth.uid()))))
  with check (exists (select 1 from zameen.tasks t where t.id = task_id and t.entity_id in (select zameen.accessible_entity_ids(auth.uid()))));

alter table zameen.entity_comments enable row level security;
drop policy if exists "comments_authenticated" on zameen.entity_comments;
create policy "comments_authenticated" on zameen.entity_comments for select using (auth.role() = 'authenticated');
drop policy if exists "comments_author_insert" on zameen.entity_comments;
create policy "comments_author_insert" on zameen.entity_comments for insert with check (author_id = auth.uid());
drop policy if exists "comments_author_update" on zameen.entity_comments;
create policy "comments_author_update" on zameen.entity_comments for update using (author_id = auth.uid()) with check (author_id = auth.uid());

alter table zameen.entity_activity enable row level security;
drop policy if exists "activity_select" on zameen.entity_activity;
create policy "activity_select" on zameen.entity_activity for select using (auth.role() = 'authenticated');
drop policy if exists "activity_insert" on zameen.entity_activity;
create policy "activity_insert" on zameen.entity_activity for insert with check (auth.role() = 'authenticated');

alter table zameen.entity_labels enable row level security;
drop policy if exists "labels_authenticated" on zameen.entity_labels;
create policy "labels_authenticated" on zameen.entity_labels for all using (auth.role() = 'authenticated');

alter table zameen.saved_views enable row level security;
drop policy if exists "views_self" on zameen.saved_views;
create policy "views_self" on zameen.saved_views for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "views_shared_read" on zameen.saved_views;
create policy "views_shared_read" on zameen.saved_views for select using (shared = true);
