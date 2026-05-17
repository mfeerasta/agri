# ADR 0007, PostGIS for field geometry

Status: Accepted, 2026-04-20.

## Context

A farm is a set of polygons. Rupafab Agri (Raiwind Farm) has roughly 30 named fields ranging from 1 to 8 acres each, with irregular shapes following canal and bund boundaries. Workers, supervisors, and the manager need to know which field a GPS point belongs to (a worker logs a diesel issuance, the platform infers the field). The platform needs to compute area from the polygon (not trust the entered acreage), measure adjacency for irrigation rotation planning, and overlay GPS-tagged photos onto a field map.

Two representations were considered. First, GeoJSON stored in a `jsonb` column. Trivial to author, no extension required, but spatial queries (point-in-polygon, area, distance, intersection) require either client-side JavaScript with Turf.js or hand-rolled SQL. Area calculation in particular is unreliable without a projection-aware library. Second, PostGIS geometry stored as `geometry(Polygon, 4326)`, with PostGIS providing first-class spatial operators, accurate area via `ST_Area(ST_Transform(geom, 3857))` or via geography casts, and spatial indexes (GIST) for fast point-in-polygon at scale.

Supabase ships PostGIS as an installable extension. Enabling it costs nothing on the shared project and unlocks an ecosystem of spatial tooling.

## Decision

Field geometry is stored as `geometry(Polygon, 4326)` via PostGIS. Migrations include `create extension if not exists postgis`. The `fields` table has a `geom` column with a GIST index. Area is computed at query time from `ST_Area(geom::geography)` and exposed as `acres_computed`; the worker-entered `acres_declared` value is preserved for reference. The `getFieldContainingPoint(lat, lng)` helper uses `ST_Contains(geom, ST_MakePoint(lng, lat)::geography)`.

Drizzle does not have first-class PostGIS column types. We use Drizzle's custom type helper to declare the column, and we write spatial queries in raw SQL via Drizzle's `sql` template tag. The few spatial queries are localized to `packages/db/src/queries/spatial.ts` and tested with seed fixtures.

The Field PWA does not author polygons. Polygon authoring is a Phase 2 deliverable in the Ops dashboard via Mapbox GL Draw. Phase 1 ingests polygons from a one-time CSV import (`field_id, wkt`) prepared by MF from the farm's existing land record.

## Consequences

Positive. Area calculation is trustworthy. Point-in-polygon for GPS-tagged photos and diesel logs is one query. Spatial adjacency queries (which fields share a boundary) are available for irrigation planning. GIST indexes keep performance acceptable at scale; the index on AGRI's 30 fields is irrelevant to query time, but the same code scales to multi-tenant Phase 2 and Phase 3.

Negative. PostGIS bloats the database with a non-trivial extension footprint (around 100 MB of installed objects). Acceptable on Supabase, which charges for storage but not for the extension itself. Drizzle does not surface PostGIS types natively; we accept the raw SQL escape hatch. New developers need to read a short primer on EPSG:4326 vs Mercator before touching spatial code.

Operational. Migrating fields between schemas or projects requires `pg_dump --no-owner` with PostGIS extension preinstalled at the target. Documented in `deploy/README.md`.

Edge cases. Self-intersecting polygons (a worker draws a bow-tie) are rejected at insert via `ST_IsValid(geom)`. Polygons with holes (a field containing a tube well structure) are supported via `geometry(Polygon, 4326)`; multi-part fields use `geometry(MultiPolygon, 4326)` in the rare case.

Exit. Moving off PostGIS would require either re-implementing spatial logic in application code with Turf.js (degraded accuracy, no spatial index) or migrating to a different spatial database. Both are expensive and unmotivated; PostGIS is the durable choice.
