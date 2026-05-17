# ADR 0001, Shared Supabase project with schema isolation

Status: Accepted, 2026-04-02.

## Context

Zameen is the second product under the Feerasta umbrella, after Haazri (a workforce attendance and timekeeping product). Haazri already runs on Supabase project `qcvxefbrzkspoldjydrx`, with its tables in the `public` schema, RLS active, and a worker base that overlaps with Zameen's field worker set (a person may be a Haazri-tracked employee and a Zameen-recorded farm worker). A net-new Supabase project for Zameen would mean a second billable plan, a second connection pool, a second Auth user pool, and a second set of Storage buckets. It would also force a synchronization layer if the same worker needs to authenticate to both products.

The alternative is to share the Supabase project and place all Zameen tables in a dedicated Postgres schema, `zameen`. Postgres has first-class schema support; RLS policies attach to tables in a schema; PostgREST exposes schemas selectively.

## Decision

Zameen tables live in the `zameen` schema in Haazri's existing Supabase project. Haazri retains `public.*`. Migrations for the two products live in separate directories. RLS policies are scoped per schema. PostgREST exposes both schemas under separate URL prefixes (`/rest/v1/` for `public`, set via `db-schema = "public,zameen"` in `config.toml`). Auth users are shared. Storage buckets are prefixed by product (`zameen-receipts`, `zameen-documents`, etc.). Cross-schema joins are permitted only with an explicit grant and only for the narrow case of joining a Zameen worker row to a Haazri attendance row.

## Consequences

Positive. One billing line. One auth user base. Faster onboarding when a worker exists in both systems. Schema isolation gives a clean blast radius for migrations and a clear permission boundary. The Supabase Postgres extensions (`pg_cron`, `pg_net`, `postgis`, `vector`) installed once are usable by both.

Negative. Coordination required on migration windows; a long-running Zameen migration could lock metadata for Haazri. Mitigated by short migrations and a staging environment. Noisy-neighbour risk on shared CPU, connection slots, and storage egress quota. Mitigated by monitoring and a plan to split if AGRI's load tips the project past comfortable utilization. RLS authoring discipline matters more than usual; a policy on `zameen.foo` must never be readable by a `public.bar` join unless explicitly granted.

Operational. Backup is shared (Supabase's daily backup covers both schemas). PITR target window must cover both products' acceptable RPO. The Supabase project owner has god rights on both.

Exit. If the noisy-neighbour cost outweighs the savings (estimated trigger: AGRI + 3 additional farm tenants), we provision a Zameen-only Supabase project and dump-restore the `zameen` schema. Estimated cutover: one weekend.
