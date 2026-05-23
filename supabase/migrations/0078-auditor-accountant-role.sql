-- 0078-auditor-accountant-role.sql
-- Adds dedicated read-only auditor + accountant roles and an export-pack
-- registry. Existing role enum already includes 'auditor' and 'accountant';
-- this migration is idempotent and additionally introduces
-- 'external_accountant' for outside CA firms. It also adds read-only RLS
-- policies that block writes for these roles across financial + audit tables
-- and creates the auditor_export_packs table.

do $$
begin
  -- Add any role values missing from the enum. Wrapped in a do-block so the
  -- migration is safe on environments that already have them.
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'auditor'
  ) then
    alter type zameen.user_role add value if not exists 'auditor';
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'accountant'
  ) then
    alter type zameen.user_role add value if not exists 'accountant';
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'external_accountant'
  ) then
    alter type zameen.user_role add value if not exists 'external_accountant';
  end if;
end $$;

-- Helper: does the calling user hold a read-only audit role on a given entity
create or replace function zameen.user_is_readonly_audit_role(uid uuid, ent uuid)
returns boolean
language sql
stable
security definer
set search_path = zameen, public
as $$
  select exists (
    select 1
    from zameen.user_entity_roles uer
    join zameen.users u on u.id = uer.user_id
    where u.auth_user_id = uid
      and uer.entity_id = ent
      and uer.is_active = true
      and uer.role in ('auditor', 'external_accountant')
  );
$$;

-- Helper: does the calling user have any write capacity on the entity
create or replace function zameen.user_can_write_entity(uid uuid, ent uuid)
returns boolean
language sql
stable
security definer
set search_path = zameen, public
as $$
  select exists (
    select 1
    from zameen.user_entity_roles uer
    join zameen.users u on u.id = uer.user_id
    where u.auth_user_id = uid
      and uer.entity_id = ent
      and uer.is_active = true
      and uer.role not in ('auditor', 'external_accountant', 'viewer')
  );
$$;

-- Export-pack registry
create table if not exists zameen.auditor_export_packs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references zameen.entities(id) on delete cascade,
  requested_by uuid not null references zameen.users(id),
  period_start date not null,
  period_end date not null,
  scope text not null default 'full' check (scope in ('full','financial_only','operational_only','specific_modules')),
  scope_modules text[],
  status text not null default 'building' check (status in ('building','ready','expired','revoked','failed')),
  storage_path text,
  download_url text,
  expires_at timestamptz,
  download_count int not null default 0,
  last_downloaded_at timestamptz,
  size_bytes bigint,
  manifest_json jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  ready_at timestamptz
);

create index if not exists idx_aep_entity on zameen.auditor_export_packs(entity_id);
create index if not exists idx_aep_status on zameen.auditor_export_packs(status);
create index if not exists idx_aep_period on zameen.auditor_export_packs(period_start, period_end);

alter table zameen.auditor_export_packs enable row level security;

drop policy if exists aep_select on zameen.auditor_export_packs;
create policy aep_select on zameen.auditor_export_packs
  for select using (entity_id in (select zameen.accessible_entity_ids(auth.uid())));

drop policy if exists aep_insert on zameen.auditor_export_packs;
create policy aep_insert on zameen.auditor_export_packs
  for insert with check (
    entity_id in (select zameen.accessible_entity_ids(auth.uid()))
    and zameen.user_can_write_entity(auth.uid(), entity_id)
  );

drop policy if exists aep_update on zameen.auditor_export_packs;
create policy aep_update on zameen.auditor_export_packs
  for update using (
    entity_id in (select zameen.accessible_entity_ids(auth.uid()))
    and zameen.user_can_write_entity(auth.uid(), entity_id)
  );

-- Read-only enforcement for audit roles on every financial + audit table.
-- Approach: layer an additional restrictive policy on each table that rejects
-- INSERT/UPDATE/DELETE when the caller holds an auditor or external_accountant
-- role on the row's entity. SELECT continues to flow through the existing
-- `*_entity` policies.

do $$
declare
  t text;
  tables text[] := array[
    'journal_entries', 'journal_lines', 'cost_allocations',
    'approval_requests', 'approval_actions',
    'payroll_runs', 'payroll_lines',
    'vendors', 'vendor_quotes', 'vendor_invoices',
    'mandi_dispatches', 'harvest_records',
    'input_purchases', 'input_issuances',
    'diesel_purchases', 'diesel_logs', 'diesel_stock_reconciliations',
    'repair_requests', 'repair_quotes', 'repair_work_orders', 'repair_invoices',
    'lease_contracts', 'lease_payments', 'sharecrop_settlements',
    'tax_periods', 'zakat_assessments', 'ushr_settlements',
    'auditor_export_packs'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'zameen' and table_name = t
    ) then
      execute format('drop policy if exists %I_block_writes on zameen.%I', t, t);
      execute format(
        'create policy %I_block_writes on zameen.%I as restrictive for all using ('
        || ' case when current_setting(''request.method'', true) is null then true'
        || ' else not zameen.user_is_readonly_audit_role(auth.uid(),'
        || ' coalesce((row_to_json(%I.*)::jsonb->>''entity_id'')::uuid, ''00000000-0000-0000-0000-000000000000''::uuid)) end'
        || ') with check ('
        || ' not zameen.user_is_readonly_audit_role(auth.uid(),'
        || ' coalesce((row_to_json(%I.*)::jsonb->>''entity_id'')::uuid, ''00000000-0000-0000-0000-000000000000''::uuid))'
        || ')',
        t, t, t, t
      );
    end if;
  end loop;
end $$;

-- Auditor activity log view, surfaces only auditor + external_accountant
-- traffic from entity_activity for the admin activity-log report.
create or replace view zameen.v_auditor_activity_log as
  select ea.id,
         ea.entity_id,
         ea.actor_id,
         u.full_name as actor_name,
         uer.role as actor_role,
         ea.verb,
         ea.payload,
         ea.occurred_at
    from zameen.entity_activity ea
    join zameen.users u on u.id = ea.actor_id
    join zameen.user_entity_roles uer on uer.user_id = u.id and uer.entity_id = ea.entity_id
   where uer.role in ('auditor','external_accountant','accountant')
   order by ea.occurred_at desc;

-- Storage bucket lives in 0078b-auditor-packs-bucket.sql so it can be
-- applied in environments that allow storage admin DDL.
