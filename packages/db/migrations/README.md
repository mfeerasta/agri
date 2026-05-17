# Migration order

Zameen mixes Drizzle-generated DDL with hand-written Supabase SQL. Order matters
because hand-written migrations (RLS, geometry conversion, RPCs) depend on the
Drizzle-created tables.

Apply in this sequence on a fresh database:

1. `supabase/migrations/0001_init_zameen_schema.sql`
   - Extensions, `zameen` schema, helper functions.
2. `pnpm --filter @zameen/db generate` then `pnpm --filter @zameen/db migrate`
   - Drizzle generates SQL into this folder (`packages/db/migrations/`).
   - Tables, enums, foreign keys are created here.
3. `supabase/migrations/0002_rls_policies.sql`
   - RLS enabled per-table, generic entity-isolation policies.
4. `supabase/migrations/0003_storage_buckets.sql`
   - Public/private storage buckets and bucket-level RLS.
5. `supabase/migrations/0004_cron_and_triggers.sql`
   - `pg_cron` schedules, LISTEN/NOTIFY trigger on approvals, audit-log immutability,
     `auth.user_entities()` / `auth.user_has_role()` / `auth.user_role_at_least()`,
     Haazri cross-schema view, edge-function dispatch helper.
6. `supabase/migrations/0005_cnic_encryption.sql`
   - pgcrypto encrypt/decrypt for `users.cnic_encrypted`. Inject the key with
     `alter database postgres set app.cnic_key = '<key>'`.
7. `supabase/migrations/0006_geometry_columns.sql`
   - Converts `fields.geometry` and `blocks.geometry` from jsonb to PostGIS
     `geometry(MultiPolygon, 4326)`. GIST indexes added.
8. `supabase/migrations/0007_rpc_functions.sql`
   - `rpc.submit_approval`, `rpc.act_on_approval`, `rpc.allocate_input_to_field`,
     `rpc.log_diesel_daily`, `rpc.compute_field_pl`. Also creates the
     `zameen.field_pnl_cache` table that the field-pl-calculator cron writes to.
9. `pnpm --filter @zameen/db seed` (full) or `pnpm --filter @zameen/db seed:minimal`
   - Minimal: auth users, AGRI entity, entity settings, 14 workflow rows.
   - Full: workers, farm, blocks, F1-F16 fields, crop plans, assets, vendors, buyers.

## Runtime configuration injected via `alter database`

```sql
alter database postgres set app.supabase_url = 'https://qcvxefbrzkspoldjydrx.supabase.co';
alter database postgres set app.service_role_jwt = '<service-role-jwt>';
alter database postgres set app.cnic_key = '<32-byte-secret>';
```

`pg_cron` jobs call `zameen.invoke_edge_function(name, payload)` which reads
those settings and uses `pg_net.http_post` to hit
`<supabase_url>/functions/v1/<name>` with `Authorization: Bearer <jwt>`.
