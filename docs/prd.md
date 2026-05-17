# Product Requirements Document, Zameen

Version 1.0. Pilot: Rupafab Agri (Raiwind Farm). Director and primary user: Meer Feerasta (MF). Engineering owner: same.

## 1. Problem statement

Medium-to-large mixed farms in Pakistan (50 to 500 acres, owner-managed, two to four families, ten to forty workers) run on a stack that has not materially changed in three decades. Daily diesel issuance is verbal. Repair invoices arrive on torn carbon paper. Inventory is in a paper register that one person guards. Approvals happen over phone calls when the owner can be reached, and over WhatsApp messages that scroll out of memory in a week. Mandi sales reconcile against arhti pads that the arhti also writes. The owner has no way to ask "what did F3 cost me this Rabi" without a two-day reconstruction by an accountant who himself does not trust the books.

The two single largest preventable losses on a farm of this size are diesel leakage (siphoning, unmetered consumption, fake receipts) and unmonitored repair spend (no quote comparison, inflated parts, repeat failures from poor first repair). Industry experience at AGRI and comparable farms suggests 15 to 30 percent of diesel and 20 to 40 percent of repair spend is recoverable with even rudimentary discipline. Both are also the two categories where the owner, sitting in Lahore or abroad, has zero counterfactual.

Zameen exists to give MF, and farms structured like AGRI, a single platform where every diesel litre, every repair rupee, every input bag, every harvest mann, and every labour day is logged at the moment it happens, by the person doing it, with photo evidence, on a phone, in Urdu, and is routed through an approval chain before any money or asset state changes. The output is a per-field, per-crop, per-season P&L that the owner can trust because every line traces back to an approval, an actor, a GPS point, and a photo.

## 2. Pilot user and rollout target

The pilot tenant is Rupafab Agri (Raiwind Farm), a roughly 100-acre mixed farm operated by the Feerasta family. Crops: wheat (Rabi), maize (Kharif), seasonal vegetables. Livestock: a small Sahiwal dairy herd and a goat unit. The farm has one Farm Manager (full time on site), two Supervisors (one cropping, one livestock), one Accountant (off site, part time), and roughly twenty workers across permanent and seasonal. MF, as Director, lives in Lahore and travels frequently to Lisbon and Detroit. He is the platform's primary decision maker and its toughest user. If MF does not look at the Approver PWA in the first week, the platform has failed.

The second-wave target is the extended family farms in central Punjab (Sheikhupura, Okara, Sahiwal districts) and dairy operations in Kasur. These share a structurally identical operating model.

## 3. Success metrics

Phase 1 success is measured at day 30, day 60, and day 90 after pilot go-live.

1. **Diesel discipline.** 90 percent of diesel purchased at AGRI in the trailing 30 days has a `diesel_purchases` row with a non-null receipt photo URL and an approved `approval_request`. Variance between meter-derived closing stock and physical dip, rolling 30 days, is within the 1.5 percent tolerance defined in `DIESEL_VARIANCE_TOLERANCE_PCT`.
2. **Per-field P&L fidelity.** For each closed crop plan at AGRI, `computeFieldPnL(cropPlanId)` produces a total cost figure within 5 percent of a manual recalculation done by the Accountant against paper records. Reconciled at end of each Rabi and Kharif.
3. **Approval coverage.** 100 percent of expense and asset transactions above Rs. 25,000 at AGRI in the trailing 30 days are linked to an `approval_requests` row in state `approved` or `executed`. Zero direct cash payments above Rs. 25,000 without a prior approval.
4. **Worker adoption.** At least 80 percent of dispatched daily diesel logs and 70 percent of attendance entries are submitted from the field by a worker or supervisor on the Field PWA, not entered after-the-fact by the Accountant. Measured on `approval_actions.gps_location` presence.
5. **Director engagement.** MF opens the Approver PWA at least once per business day. Median time-to-decision (submitted to approved/rejected) is under 6 hours for daytime submissions.

## 4. Personas

**Director (MF).** Approves expenditures above farm manager threshold. Reviews per-field P&L. Reviews feasibility studies. Approves all land, lease, livestock, capex, loan, and tax actions regardless of amount. Uses Approver PWA on phone, sometimes on iPad. Often abroad, sometimes on prepaid data. Speaks English in the app, Urdu with workers.

**Farm Manager.** On-site daily. Approves mid-tier expenditures (up to Rs. 50k diesel, Rs. 100k inputs, Rs. 50k repairs). Manages crop plans, schedules irrigation, dispatches the Supervisor. Uses Ops dashboard on a tablet and the Approver PWA on a phone. Bilingual, prefers Roman Urdu inputs.

**Supervisor.** Field-level. Approves small expenditures (up to Rs. 25k diesel and inputs, Rs. 10k repairs). Issues diesel, records attendance, raises repair requests. Urdu primary, basic literacy in Roman Urdu. Field PWA on a low-end Android.

**Accountant.** Off site, comes to the farm weekly. Closes the cash book, files vendor payments, prepares the per-field P&L for MF. Uses the Ops dashboard on a laptop. English primary.

**Worker.** Operator, driver, livestock attendant, or general labour. Logs attendance, captures diesel meter readings, takes photos of damage, signs off repairs with thumbprint or signature pad. Urdu only, oral literacy in many cases. Field PWA with voice input on a shared low-end Android.

## 5. Phase 1 module set

Twelve modules, in priority order.

1. **Approvals.** The platform's spine. State machine in `packages/approvals/src/state-machine.ts`, threshold routing in `routing.ts`, delegation in `delegation.ts`. Every cost-bearing or asset-touching action lives downstream of `submitApproval`. The Approver PWA at `approve.agri.feerasta.ai` is the canonical channel; WhatsApp is notification only.

2. **Diesel.** Top loss leader, first-class module. Purchase with mandatory receipt photo and odometer-style fuel-stock book. Daily issuance log with hour-meter, asset, operator, field. Closing stock reconciliation with variance flagging at 1.5 percent. Cost allocations to `cost_pool='diesel'` against `field_id`, with proportional split when one trip serves multiple fields.

3. **Repair.** Top second loss leader. Request with photo of the failure, multi-quote intake (minimum two quotes above threshold), quote selection with stored reason, approval routing, work order with parts and labour breakdown, closure with operator sign-off and warranty window. Parts history per asset feeds asset health flags.

4. **Land and crop plans.** `entities → farms → blocks → fields → plots`. PostGIS polygons for fields. Soil tests per field. Crop plans bound to season, variety, planned acres, calendar. Stage logs (sowing, irrigation, spray, weeding, harvest).

5. **Inventory.** Three sub-types: inputs (seed, fertilizer, pesticide), produce (harvested grain, fodder), assets (tractors, implements, vehicles, pumps). Each issuance to a field writes a `cost_allocation`. Asset hour meters drive depreciation and fuel-burn anomaly checks.

6. **Labor and attendance.** Worker register, daily attendance (in/out with GPS), task assignment, wage book. Per-field labour cost capture for `cost_pool='labor_field'` and `'labor_livestock'`.

7. **Finance and cost allocation.** `cost_allocations` is the single source. `proportionalSplit` handles cross-field allocations. Balanced journal posting in `journal.ts`. Per-field P&L in `field-pnl.ts`. Cash book, vendor ledger, receivables.

8. **Sales and mandi.** Harvest records to mandi settlements via arhti. Captures gross weight, deductions (kasur, bardana, commission, freight), net received. Reconciliation against `harvest_records`.

9. **Procurement.** Vendor master, RFQ, purchase orders for inputs and capex. Three-quote rule above per-type threshold.

10. **Livestock (basic).** Herd register, milk daily log (per animal), vet visits, feed allocation as a cost pool. Phase 1 covers data capture only; analytics in Phase 2.

11. **Compliance.** Lease documents, fard, khasra-khatooni references, lagaan receipts, electricity meter readings for tube wells, regulatory filings.

12. **System.** Multi-entity isolation, RBAC, audit log, RLS policies, storage buckets, edge functions placeholder.

## 6. Out-of-scope for Phase 1

The following are explicit deferrals.

**Phase 2 (months 4 to 9).**
- Livestock analytics: lactation curves, breeding calendar, mortality KPIs.
- Commerce: B2B order flow for direct-to-restaurant produce sales.
- WhatsApp Business notification dispatcher.
- Mapbox field-polygon editor.
- Edge function cron jobs (daily diesel reconciliation, anomaly alerts).
- Cash flow forecasting on top of the journal.

**Phase 3 (months 10 to 18).**
- Satellite NDVI integration for crop health monitoring.
- Pest identification vision model (capture leaf photo, return likely pest with confidence).
- Urdu and Punjabi Whisper-class STT replacing the placeholder browser SpeechRecognition.
- AI-driven anomaly detection across diesel, repairs, attendance.
- Feasibility study generator (free-text business case to structured ROI model).

**Phase 4 (months 18+).**
- External-facing tenant onboarding (other farm families).
- Open APIs for arhti and input dealer integration.
- Mandi price subscription feed.

## 7. Risk register

**Worker adoption.** Workers do not own smartphones, share devices, and have intermittent literacy. Mitigation: BigButton home, voice-first capture, photo-first flows, supervisor-supervised initial weeks, attendance entry rewards.

**Prepaid data and rural connectivity.** Worker phones are on prepaid plans that lapse. Field signal at AGRI is 3G to flaky 4G. Mitigation: full offline queue in IndexedDB, photo compression to under 200 KB, service worker with NetworkFirst on API and CacheFirst on assets, sync on `online` event, status dot on every screen.

**Urdu UX failure modes.** Nastaliq line height regressions, RTL number leakage, mixed-direction input fields, locale-aware date pickers. Mitigation: Noto Nastaliq Urdu locked in font stack, dedicated `localization.md`, snapshot tests of the field PWA in `ur` locale, native Urdu speaker review of every release.

**Supabase coupling with Haazri.** Zameen and Haazri share one Supabase project. Risks: noisy-neighbour quota, cross-schema permission leaks, migration coordination. Mitigation: schema isolation in `zameen.*`, RLS denies cross-schema unless explicit grant, separate migration directories, monitoring on shared quotas. ADR 0001 covers this in detail.

**Approver concentration on MF.** Director-only approval types create a single point of failure. Mitigation: delegation infrastructure in `user_entity_roles`, MF delegates Farm Manager when traveling, audit trail records the delegate explicitly.

**Money rounding and decimal drift.** Float arithmetic on rupees has caused real losses at adjacent farms. Mitigation: bigint paisa in JS via `@zameen/shared/money`, `decimal(.., 2)` in DB, no floats anywhere. ADR 0002 covers this.

**Photo storage costs.** High-volume geotagged photos against Supabase Storage egress economics. Mitigation: Cloudflare R2 with presigned PUT, client-side resize. ADR 0005 covers this.

## 8. Phase rollout

**Phase 1 (pilot, Rupafab Agri (Raiwind Farm), weeks 0 to 12).** Foundation. Approval engine, diesel, repair, land/crop plans, inventory, labour, finance, sales, procurement, compliance, basic livestock, system. Single tenant. Hetzner deployment. Approver PWA, Field PWA, Ops dashboard, Web management. WhatsApp notification stub.

**Phase 2 (months 4 to 9).** Livestock analytics, commerce flow, WhatsApp dispatcher, edge function cron jobs, Mapbox polygon editor, cash flow forecast. Soft onboarding of a second family farm.

**Phase 3 (months 10 to 18).** Satellite NDVI, pest ID, Urdu STT, AI anomaly detection, feasibility study generator. Hardened multi-tenant.

**Phase 4 (months 18+).** External onboarding, public APIs, mandi price feed, partner ecosystem.

## 9. Non-goals (permanent)

The platform will not become a multi-currency ledger. The platform will not host arhti or input-dealer accounts as their primary system; we integrate, we do not absorb. The platform will not replace WhatsApp as the farm's social channel; we ride alongside it.
