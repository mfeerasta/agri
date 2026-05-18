# Zameen E2E (Playwright)

End-to-end smoke harness covering the worker-to-director golden path plus
every critical mutation. Run after every deploy, gated on PRs.

## Run locally

```bash
# Start Supabase locally + apply migrations + seed
pnpm supabase:start
pnpm db:migrate
pnpm db:seed

# Run the full suite (boots all 4 dev servers via webServer)
pnpm test:e2e

# Run a single spec
pnpm exec playwright test e2e/specs/01-worker-attendance.spec.ts

# Debug interactively
pnpm exec playwright test --ui

# Force serial execution (helpful when isolating flakes)
E2E_SEQUENTIAL=1 pnpm test:e2e
```

## Run against staging or prod

```bash
E2E_WEB_URL=https://staging.agri.feerasta.ai \
E2E_FIELD_URL=https://field.staging.agri.feerasta.ai \
E2E_OPS_URL=https://ops.staging.agri.feerasta.ai \
E2E_APPROVE_URL=https://approve.staging.agri.feerasta.ai \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm test:e2e
```

CI sets `CI=1` which skips `webServer` and runs against the provided URLs.

## Specs

| Spec | Project | What it proves |
| --- | --- | --- |
| `00-smoke` | web | Page shells boot, `/api/health` green |
| `01-worker-attendance` | field | Worker check-in writes attendance with GPS |
| `02-worker-diesel-log` | field | Daily log creates row + cost allocation |
| `03-supervisor-approve-under-threshold` | web | Rs 18k routes to supervisor |
| `04-farm-manager-approve` | web | Rs 75k routes to FM |
| `05-director-approval-via-approver-pwa` | approve | Rs 150k routes to director with GPS |
| `06-repair-multi-quote-flow` | approve | Request to quotes to approval to closure |
| `07-harvest-to-mandi` | web | Lot to storage to dispatch to settlement |
| `08-field-pnl-end-of-season` | web | P&L numbers correct, PDF export valid |
| `09-offline-queue-resilience` | field | IndexedDB queue drains on reconnect |
| `10-feasibility-study` | web | Draft, edit, approve flow |
| `11-csv-bulk-import` | web | Worker CSV import, 5 rows inserted |
| `12-automation-trigger` | web | Overdue task fires recipe |
| `13-receipt-ocr-autofill` | field | OCR autofill (gated on `OPENAI_API_KEY`) |
| `14-export-pdf-xlsx` | web | Seasonal report PDF + XLSX |
| `15-rls-cross-entity-isolation` | web | Entity A user cannot see entity B data |

## Fixtures

`e2e/fixtures/` holds the inputs each spec needs. JPGs are tiny valid placeholders
that satisfy the file-upload validators without slowing CI. CSVs use kebab-case
codes and Pakistani phone formats so they match production validators.

## Cleanup

Every spec creates an isolated `e2e-<rand>` entity tree. The `afterAll` hook calls
`cleanup(tracker)` which deletes auth users + any row whose `code` or `name` starts
with the tracker tag. Two specs may run in parallel without conflict.

If a run aborts mid-test, leftover rows are harmless (they're prefixed `e2e-`) but
you can wipe them with:

```sql
DELETE FROM zameen.entities WHERE code LIKE 'e2e-%';
```

## Conventions

- Kebab-case filenames, no underscores.
- Spec files are numbered for stable ordering when reading reports.
- Helpers in `e2e/helpers/`; no helper logic inside spec files.
- Service role for setup/teardown only — assertions on auth state go through the UI.
- Each spec is parallel-safe and idempotent.
