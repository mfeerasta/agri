-- Convert zameen.fields.geometry and zameen.blocks.geometry from jsonb to PostGIS
-- geometry(MultiPolygon, 4326), keeping data via ST_GeomFromGeoJSON. Runs AFTER
-- the Drizzle-generated tables exist. Idempotent: skips if already converted.

create extension if not exists postgis;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'zameen' and table_name = 'fields'
      and column_name = 'geometry' and data_type = 'jsonb'
  ) then
    alter table zameen.fields add column geometry_geom geometry(MultiPolygon, 4326);
    update zameen.fields
      set geometry_geom = case
        when geometry is null then null
        when geometry ? 'type' and geometry->>'type' = 'MultiPolygon'
          then ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)
        when geometry ? 'type' and geometry->>'type' = 'Polygon'
          then ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))
        else null
      end;
    alter table zameen.fields drop column geometry;
    alter table zameen.fields rename column geometry_geom to geometry;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'zameen' and table_name = 'blocks'
      and column_name = 'geometry' and data_type = 'jsonb'
  ) then
    alter table zameen.blocks add column geometry_geom geometry(MultiPolygon, 4326);
    update zameen.blocks
      set geometry_geom = case
        when geometry is null then null
        when geometry ? 'type' and geometry->>'type' = 'MultiPolygon'
          then ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)
        when geometry ? 'type' and geometry->>'type' = 'Polygon'
          then ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))
        else null
      end;
    alter table zameen.blocks drop column geometry;
    alter table zameen.blocks rename column geometry_geom to geometry;
  end if;
end$$;

create index if not exists fields_geometry_gist on zameen.fields using gist (geometry);
create index if not exists blocks_geometry_gist on zameen.blocks using gist (geometry);

-- Helper used by the seed and any future server action to coerce a GeoJSON
-- string (Polygon or MultiPolygon) into geometry(MultiPolygon, 4326). Lets
-- application code keep working with plain JSON shapes while the column type
-- is true PostGIS. Idempotent via CREATE OR REPLACE.
create or replace function zameen.geom_from_json(p text)
returns geometry
language sql
immutable
as $$
  select case
    when p is null then null
    when (p::jsonb)->>'type' = 'MultiPolygon'
      then ST_SetSRID(ST_GeomFromGeoJSON(p), 4326)
    when (p::jsonb)->>'type' = 'Polygon'
      then ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p), 4326))
    else null
  end;
$$;
