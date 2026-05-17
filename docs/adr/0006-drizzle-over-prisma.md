# ADR 0006, Drizzle ORM over Prisma

Status: Accepted, 2026-04-08.

## Context

The platform schema is large (18 schema files in `packages/db/src/schema/`), uses Postgres-specific features (enums, generated columns, PostGIS geometry, jsonb with structured payloads, RLS policies, pg_cron triggers), and lives in a non-default schema (`zameen`). The ORM choice affects schema authoring ergonomics, migration tooling, type generation, query construction, and the ability to drop down to raw SQL where Postgres features outrun the ORM.

Two candidates were evaluated: Prisma and Drizzle. Both are TypeScript-first, both generate types from a schema definition, both have Supabase community support.

Prisma's strengths: a polished schema DSL, mature tooling, broad ecosystem, well-understood query API. Weaknesses for this project: limited support for non-default schemas (works but feels grafted on), Prisma Migrate cannot author the RLS and `pg_cron` SQL we need, the generated client runs a query engine binary that complicates the Hetzner standalone build, and the query API does not gracefully accommodate the spatial queries we run via PostGIS.

Drizzle's strengths: schema authored as TypeScript files (`packages/db/src/schema/*.ts`), maps cleanly to multi-schema setups (`pgSchema('zameen')`), migration tooling that respects raw SQL escape hatches (`sql\`\`` for RLS, triggers, extensions), no query engine binary, ergonomic for both ORM-style and raw SQL queries, type inference that survives complex joins, smaller bundle in the Next.js standalone build. Weaknesses: younger ecosystem, less convenience tooling around relations, fewer Stack Overflow answers.

## Decision

Use Drizzle ORM for `packages/db`. Schema is authored as TypeScript across files in `src/schema/`, one file per domain (approvals, assets, diesel, repairs, etc.). Migrations are generated via `drizzle-kit generate` and committed under `packages/db/migrations/`. Manual SQL migrations for extensions, RLS, storage buckets, and pg_cron live alongside Drizzle-generated ones under `supabase/migrations/` and are applied via the Supabase migration tool.

Repository-style helpers live in `packages/db/src/queries/`. Complex joins (cost allocation joins, P&L aggregations) use Drizzle's `sql` template tag where the query is materially more readable in raw SQL than in the query builder. Spatial queries against PostGIS use raw SQL exclusively.

## Consequences

Positive. Schema is just TypeScript files; type changes propagate without a separate codegen step. The standalone Next.js build is smaller because there is no query engine binary. Multi-schema setup works without ceremony. Raw SQL escape hatch is first-class, not an afterthought; this matters for RLS authoring and for any future PostGIS-heavy reporting.

Negative. Smaller community means fewer Stack Overflow answers and a younger pool of tooling (database introspection, schema diff, seed scaffolding). Mitigated by the schema being explicit and small enough to read end-to-end. Some relation patterns require more boilerplate than in Prisma; acceptable given how few times this code is written.

Operational. Migration discipline is on us. The convention: Drizzle migrations are for table shape; manual SQL migrations are for RLS, extensions, triggers, functions, and grants. Every PR that touches schema includes both as needed.

Exit. Migrating off Drizzle is straightforward because the schema and queries are explicit TypeScript with raw SQL where it matters. There is no ORM-magic to unwind. Estimated effort to migrate to Kysely or to raw `postgres.js` is one engineer-week.
