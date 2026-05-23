-- 0087 custom reports, dashboards, scheduled deliveries
create table if not exists zameen.custom_reports (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  created_by uuid not null,
  name text not null,
  name_ur text,
  description text,
  visibility text not null default 'private' check (visibility in ('private','team','entity','public')),
  data_source text not null,
  filters jsonb not null default '[]'::jsonb,
  group_by text[],
  aggregations jsonb not null,
  sort_by text,
  chart_kind text check (chart_kind in ('table','bar','line','pie','area','heatmap','scatter','sankey','sunburst','radar','kpi_cards','map')),
  chart_config jsonb,
  row_limit int not null default 1000,
  refresh_kind text not null default 'on_open' check (refresh_kind in ('on_open','manual','scheduled')),
  schedule_cron text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx-cr-entity on zameen.custom_reports(entity_id);

create table if not exists zameen.report_executions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references zameen.custom_reports(id) on delete cascade,
  executed_at timestamptz not null default now(),
  executed_by uuid,
  row_count int,
  duration_ms int,
  result_snapshot jsonb,
  exported_to text
);
create index if not exists idx-re-report on zameen.report_executions(report_id);

create table if not exists zameen.custom_dashboards (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  created_by uuid not null,
  name text not null,
  description text,
  visibility text not null default 'private',
  layout jsonb not null,
  default_filters jsonb,
  refresh_seconds int,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx-cd-entity on zameen.custom_dashboards(entity_id);

create table if not exists zameen.scheduled_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references zameen.custom_reports(id) on delete cascade,
  recipients jsonb not null,
  delivery_format text not null check (delivery_format in ('email_pdf','email_xlsx','whatsapp_summary','dashboard_embed')),
  schedule_cron text not null,
  last_delivered_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx-srd-report on zameen.scheduled_report_deliveries(report_id);

alter table zameen.custom_reports enable row level security;
alter table zameen.report_executions enable row level security;
alter table zameen.custom_dashboards enable row level security;
alter table zameen.scheduled_report_deliveries enable row level security;

create policy cr_entity on zameen.custom_reports for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy re_via_report on zameen.report_executions for all using (
  exists (select 1 from zameen.custom_reports r where r.id = report_id and r.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
);
create policy cd_entity on zameen.custom_dashboards for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
create policy srd_via_report on zameen.scheduled_report_deliveries for all using (
  exists (select 1 from zameen.custom_reports r where r.id = report_id and r.entity_id in (select zameen.accessible_entity_ids(auth.uid())))
);
