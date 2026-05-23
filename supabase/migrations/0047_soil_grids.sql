-- ISRIC SoilGrids baseline soil profile snapshot.
-- Stored per-field and (optionally) per-farm so we can render a baseline soil
-- profile before any lab test has been done. The structure is the JSON shape
-- returned by packages/shared/src/soilgrids.ts (SoilGridsResult).

alter table zameen.fields add column if not exists soil_grids_data jsonb;
alter table zameen.fields add column if not exists soil_grids_fetched_at timestamptz;

alter table zameen.farms add column if not exists soil_grids_data jsonb;
alter table zameen.farms add column if not exists soil_grids_fetched_at timestamptz;
