-- Adds an 'auditor' value to the user_role enum and grants SELECT-only RLS on every
-- table in the zameen schema. Defense in depth: no write policies exist for auditors,
-- so even if app-layer checks slip, the database refuses inserts/updates/deletes.

do $$ begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'auditor'
      and enumtypid = (
        select oid from pg_type
        where typname = 'user_role'
          and typnamespace = (select oid from pg_namespace where nspname = 'zameen')
      )
  ) then
    alter type zameen.user_role add value 'auditor';
  end if;
end $$;

create or replace function zameen.is_auditor(p_user uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from zameen.user_entity_roles
    where user_id = p_user
      and role = 'auditor'
      and is_active = true
  );
$$;

-- Grant SELECT to auditors on every table in zameen schema (except audit_log,
-- which already has a permissive read for accountants/directors).
do $$
declare
  t text;
begin
  for t in
    select table_name
    from information_schema.tables
    where table_schema = 'zameen'
      and table_type = 'BASE TABLE'
      and table_name not in ('audit_log')
  loop
    execute format(
      'drop policy if exists "%1$s_auditor_select" on zameen.%1$I;',
      t
    );
    execute format(
      'create policy "%1$s_auditor_select" on zameen.%1$I for select using (zameen.is_auditor(auth.uid()));',
      t
    );
  end loop;
end $$;
