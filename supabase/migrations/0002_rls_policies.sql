-- Row-Level Security policies applied AFTER Drizzle creates the tables.
-- Run order: 0001 (schema) -> drizzle generate/migrate -> 0002 (RLS).

do $$
declare
  t text;
  table_list text[] := array[
    'entities','users','user_entity_roles','permissions','entity_settings',
    'farms','blocks','fields','plots','soil_tests','water_sources','land_tenure_records',
    'crop_profiles','crop_plans','crop_stage_logs','harvest_records',
    'inputs','input_purchases','input_issuances','storage_locations','produce_lots','produce_movements',
    'assets','asset_hour_meters','asset_logs',
    'fuel_storage_tanks','diesel_purchases','diesel_daily_logs','diesel_stock_reconciliations',
    'repair_requests','repair_quotes','repair_work_orders','parts_replaced',
    'animals','breeding_events','milk_records','health_events','feed_records',
    'workers','worker_documents','attendance_records','tasks','task_assignments',
    'task_completions','piece_rate_logs','payroll_runs','payslips',
    'accounts','journal_entries','journal_lines','cost_allocations','cash_flow_forecasts',
    'approval_workflows','approval_requests','approval_actions',
    'feasibility_studies','feasibility_attachments','feasibility_comments',
    'vendors','purchase_orders','goods_received_notes','purchase_invoices',
    'buyers','arhtis','mandi_dispatches','mandi_settlements','sales_orders',
    'milk_dispatches','milk_settlements',
    'documents','tax_filings','subsidy_transactions','spray_diaries',
    'audit_log','notifications','weather_records','market_prices','offline_sync_queue'
  ];
begin
  foreach t in array table_list loop
    execute format('alter table zameen.%I enable row level security', t);
  end loop;
end$$;

-- Entity isolation: a row is visible if its entity_id is in the user's accessible entities,
-- OR if the table has no entity_id column (handled per-table below).

-- Generic policy generator for tables that contain entity_id.
do $$
declare
  rec record;
begin
  for rec in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'zameen' and c.column_name = 'entity_id'
  loop
    execute format($p$
      drop policy if exists "%1$s_entity_isolation_select" on zameen.%1$I;
      create policy "%1$s_entity_isolation_select" on zameen.%1$I
        for select using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
      drop policy if exists "%1$s_entity_isolation_write" on zameen.%1$I;
      create policy "%1$s_entity_isolation_write" on zameen.%1$I
        for all using (entity_id in (select zameen.accessible_entity_ids(auth.uid())))
        with check (entity_id in (select zameen.accessible_entity_ids(auth.uid())));
    $p$, rec.table_name);
  end loop;
end$$;

-- users: a user can read their own row plus other users in their accessible entities.
drop policy if exists "users_self_or_entity_select" on zameen.users;
create policy "users_self_or_entity_select" on zameen.users
  for select using (
    auth_user_id = auth.uid()
    or default_entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  );

drop policy if exists "users_self_update" on zameen.users;
create policy "users_self_update" on zameen.users
  for update using (auth_user_id = auth.uid());

-- Master data with no entity_id (crop_profiles, permissions, market_prices) is readable by all authenticated users.
do $$
declare
  t text;
begin
  foreach t in array array['crop_profiles','permissions','market_prices'] loop
    execute format('drop policy if exists "%1$s_public_read" on zameen.%1$I; create policy "%1$s_public_read" on zameen.%1$I for select using (auth.role() = ''authenticated'');', t);
  end loop;
end$$;

-- audit_log: append-only for authenticated, read scoped to entity access.
drop policy if exists "audit_log_select" on zameen.audit_log;
create policy "audit_log_select" on zameen.audit_log
  for select using (
    entity_id is null
    or entity_id in (select zameen.accessible_entity_ids(auth.uid()))
  );

drop policy if exists "audit_log_insert" on zameen.audit_log;
create policy "audit_log_insert" on zameen.audit_log
  for insert with check (auth.role() = 'authenticated');

-- Disallow update/delete on audit_log entirely (no policy = denied with RLS on).
