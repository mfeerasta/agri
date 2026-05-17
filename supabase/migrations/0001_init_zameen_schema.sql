-- Zameen base migration: schema, extensions, helper functions.
-- Drizzle-generated tables follow in subsequent migrations.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

create schema if not exists zameen;

grant usage on schema zameen to anon, authenticated, service_role;
alter default privileges in schema zameen
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema zameen
  grant usage, select on sequences to authenticated;

-- Helper: extract entity id from current JWT app_metadata.
create or replace function zameen.current_entity_id()
returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'default_entity_id',
      current_setting('request.jwt.claims', true)::jsonb ->> 'default_entity_id'
    ),
    ''
  )::uuid;
$$;

-- Helper: list of entity ids the user has access to.
create or replace function zameen.accessible_entity_ids(p_user uuid)
returns setof uuid
language sql stable
as $$
  select uer.entity_id
  from zameen.user_entity_roles uer
  where uer.user_id = p_user and uer.is_active = true;
$$;

-- Helper: current user id (auth.uid wrapper).
create or replace function zameen.current_user_id()
returns uuid
language sql stable
as $$
  select auth.uid();
$$;

-- Reusable trigger to keep updated_at fresh.
create or replace function zameen.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
