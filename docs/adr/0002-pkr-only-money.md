# ADR 0002, PKR-only money handling

Status: Accepted, 2026-04-02.

## Context

Zameen serves Pakistani farms. Every transaction the platform records (diesel purchase, input issuance, repair invoice, mandi settlement, labour wage, lease payment, tax filing) is denominated in PKR. The pilot tenant Rupafab Agri (Raiwind Farm) has zero non-PKR transactions. The realistic Phase 2 and Phase 3 tenants (extended family farms in Punjab) are similarly PKR-only. There is no operational reason to model multiple currencies in the platform.

Money has two surfaces: storage and computation. Storage in Postgres is unambiguous, `decimal(p, s)` is the right choice; there is no debate. Computation in JavaScript is where farms lose money. JavaScript's `number` type is IEEE 754 double, which silently loses precision past 15 significant digits, and rounding errors compound across allocation splits, journal balancing, and proportional cost distribution. Bigint is precise but verbose, requires conversion helpers, and is foreign to most JS developers.

## Decision

The platform is PKR-only. There is no FX engine, no currency code column, no per-entity base currency setting. The storage layer uses `decimal(p, 2)` Postgres columns for all monetary fields. The application layer represents money as `bigint` paisa via `@zameen/shared/money` (`type PKR = bigint`). Conversion helpers (`fromRupees`, `toRupeesNumber`, `toRupeesString`, `formatPkr`) live in that module. UI display goes through the `<Pkr value={...} mode="plain | lac_crore" />` component, never through raw `toLocaleString` or string concatenation.

Foreign-currency references (a vendor quoting in USD for an imported part, an export sale invoice) are stored as free-text in description fields. They do not enter the money layer. If the platform ever needs to record a multi-currency transaction, the convention is: convert at the actor's documented FX rate, store the PKR figure in the money column, store the original currency and rate in a structured `payload.fxRef` field for audit.

## Consequences

Positive. The money layer is small, type-safe, and testable. Bigint paisa eliminates float drift on every arithmetic path: allocation splits, journal balancing, lac/crore formatting. The DB schema is uniform across modules. New developers onboard to the money module in under an hour. Display is always centralized through one component, which means a single change rolls out lac/crore mode or Eastern Arabic-Indic digits everywhere.

Negative. The platform cannot onboard a tenant that operates primarily in a non-PKR currency. Acceptable; that tenant does not exist in Phase 1 through Phase 3. The bigint-paisa convention is mildly unusual; new developers must read the money module before writing financial code. Mitigated by a strict ESLint rule that bans `number` arithmetic on money-typed values.

Numerical limits. `bigint` paisa supports values up to `9.2 * 10^18`, which is well past any plausible Pakistani farm transaction. Postgres `decimal(20, 2)` is the storage type, ceiling Rs. 999,999,999,999,999,999.99.

Exit. Going multi-currency requires (a) adding a `currency_code` column to every money table, (b) adding an FX rate table, (c) reworking allocations and journal balancing to convert. Estimated effort: two engineer-months. We will not do this work speculatively.
