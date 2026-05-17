# CLAUDE.md — Zameen

Working notes for Claude Code on this repo. Source-of-truth PRD lives in the user's CLAUDE.md (full version). This file captures the deltas and conventions actually wired into the code.

## What's built (Phase 1)

- Monorepo: pnpm + Turbo. Four Next.js 15 apps (`web`, `field`, `ops`, `approve`), six packages.
- DB: Drizzle schema covering all 12 modules in the `zameen` schema. Supabase migrations create extensions, schema, RLS policies, and storage buckets. Seed loads AGRI entity, crop library, chart of accounts, default approval workflows.
- Approval engine: bounded state machine, threshold routing, delegation. Engine in `packages/approvals/src/engine.ts`. Every action emits an `approval_actions` audit row.
- Finance: cost allocation with proportional split, balanced-journal posting with reversal, per-field P&L via `computeFieldPnL(cropPlanId)`.
- Diesel module: purchase form with mandatory receipt photo + auto-approval trigger; daily log with hour-meter, field allocation, cost split into `cost_pool='diesel'`; stock reconciliation with variance computation.
- Repair module: request → multi-quote → quote selection (with reason) → approval routing → work order → closure with operator sign-off and warranty window.
- Approver PWA at `approve.agri.feerasta.ai`: queue, detail with cash position + audit trail, GPS-captured decisions.
- Field PWA: Urdu RTL shell, BigButton home, IndexedDB offline queue, PhotoUploader with client-side compression to ≤200 KB / 1600px long edge.

## Domain

- Production primary: `agri.feerasta.ai`
- Subdomains: `field.agri.feerasta.ai`, `ops.agri.feerasta.ai`, `approve.agri.feerasta.ai`, `api.agri.feerasta.ai`

## Architectural locks

1. **PKR only.** No FX. Storage = decimal(.., 2) in DB, bigint paisa in JS via `@zameen/shared/money`.
2. **Approval-first.** Don't write a path that touches money, inventory, or asset state without routing through `@zameen/approvals` first. Even Director approvals are recorded.
3. **WhatsApp is notification-only.** Approve/reject actions happen in the Approver PWA where full context (cash position, quote comparison) is shown.
4. **Schema isolation.** Zameen lives in `zameen.*`. Haazri keeps `public.*`. Cross-schema joins via grants when needed.
5. **Photo evidence is non-negotiable** for diesel purchases, repair issues, and final repair invoices. Zod validators enforce at least one URL.

## Conventions

- File names: **kebab-case**, no underscores anywhere.
- No em-dashes in code comments, docs, commit messages.
- No "Confidential" markers in generated documents.
- Server actions over API routes for mutations; `'use server'` at the top.
- All zod validators in `@zameen/shared/validators`. Don't redefine inline.
- All cost allocations include `field_id` (or `null` for general overhead) and a `cost_pool` from `COST_POOLS`.
- Every JSX form that captures a Rupee amount uses the `Pkr` component for display, never raw `toLocaleString`.

## When you add a new approval-requiring action

1. Add the approval type to `enums.ts` (`approval_type` enum) and to `APPROVAL_TYPES` in `@zameen/shared/constants.ts`.
2. Add a default threshold row to `DEFAULT_APPROVAL_THRESHOLDS_PKR`.
3. Call `submitApproval({...})` from the server action that creates the underlying record. Pass a complete `contextSnapshot` so the Approver PWA can render it.
4. On the read side, render `<ApprovalBanner />` with the linked `approval_requests.state`.
5. Add a row to `approval_workflows` in the seed if the entity needs a non-default policy.

## When you add a new cost-bearing action

1. Insert the underlying record (e.g. a repair invoice, an input issuance).
2. Call `allocateCost({...})` from `@zameen/finance` with `sourceModule`, `sourceRecordId`, `cost_pool`, `field_id` (and/or `cropPlanId`/`assetId`), `amountPkr`.
3. If the action settles cash, also post a balanced journal entry via `postJournal()`. The journal's `sourceRecordId` must match the cost allocation's so audit can walk both sides.

## Things deliberately not built yet

- Edge functions / cron jobs (Phase 2)
- Satellite NDVI integration (Phase 3)
- Pest ID vision model (Phase 3)
- Urdu/Punjabi STT (Phase 3) — current voice input uses the browser's SpeechRecognition API as a placeholder.
- WhatsApp Business notification dispatcher (will live in `supabase/functions/notify-whatsapp`).
- Mapbox field-polygon editor.
- Feasibility study UI (data model is there, UI is not).
