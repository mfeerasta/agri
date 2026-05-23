-- 0053-holidays
-- Pakistan public + religious holiday cache, populated by the holidays-sync
-- edge function annually. Used by payroll divisor and dashboard widgets.

create table if not exists zameen.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  hijri_date text,
  name text not null,
  name_ur text,
  kind text not null check (kind in ('public','religious','observance')),
  fixed boolean not null default false,
  source text not null default 'nager',
  fetched_at timestamptz not null default now(),
  unique (date, name)
);

create index if not exists idx_holidays_date on zameen.holidays(date);

alter table zameen.holidays enable row level security;

drop policy if exists "holidays_authenticated" on zameen.holidays;
create policy "holidays_authenticated" on zameen.holidays for select using (auth.role() = 'authenticated');
