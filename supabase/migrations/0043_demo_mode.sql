-- 0043 demo mode
-- Adds is_demo flags to entities and transactional tables so a one-shot
-- DELETE WHERE is_demo = true cleans up the entire demo dataset per entity.

alter table zameen.entities add column if not exists is_demo boolean not null default false;

-- Transactional tables. Some already carry is_training; demo mode is orthogonal.
alter table zameen.diesel_purchases add column if not exists is_demo boolean not null default false;
alter table zameen.diesel_daily_logs add column if not exists is_demo boolean not null default false;
alter table zameen.repair_requests add column if not exists is_demo boolean not null default false;
alter table zameen.harvest_records add column if not exists is_demo boolean not null default false;
alter table zameen.attendance_records add column if not exists is_demo boolean not null default false;
alter table zameen.task_completions add column if not exists is_demo boolean not null default false;
alter table zameen.milk_records add column if not exists is_demo boolean not null default false;
alter table zameen.cost_allocations add column if not exists is_demo boolean not null default false;
alter table zameen.journal_entries add column if not exists is_demo boolean not null default false;
alter table zameen.approval_requests add column if not exists is_demo boolean not null default false;

create index if not exists idx_diesel_purchases_demo on zameen.diesel_purchases(is_demo) where is_demo = true;
create index if not exists idx_diesel_daily_logs_demo on zameen.diesel_daily_logs(is_demo) where is_demo = true;
create index if not exists idx_repair_requests_demo on zameen.repair_requests(is_demo) where is_demo = true;
create index if not exists idx_harvest_records_demo on zameen.harvest_records(is_demo) where is_demo = true;
create index if not exists idx_attendance_records_demo on zameen.attendance_records(is_demo) where is_demo = true;
create index if not exists idx_task_completions_demo on zameen.task_completions(is_demo) where is_demo = true;
create index if not exists idx_milk_records_demo on zameen.milk_records(is_demo) where is_demo = true;
create index if not exists idx_cost_allocations_demo on zameen.cost_allocations(is_demo) where is_demo = true;
create index if not exists idx_journal_entries_demo on zameen.journal_entries(is_demo) where is_demo = true;
create index if not exists idx_approval_requests_demo on zameen.approval_requests(is_demo) where is_demo = true;
