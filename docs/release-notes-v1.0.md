# Zameen v1.0 release notes

Release date: 2026-05-18
Scope: Phase 1, Rupafab Agri, Raiwind. Rabi 2025-26 pilot.

## Overview

v1.0 ships the consolidated operations ledger for Rupafab Agri. Twelve modules, three role-specific apps, one approval engine, one balanced-journal posting backbone. All money is PKR. All photos are evidence. All approvals are audited.

## Modules delivered

1. Land and fields. Polygon-mapped acreage, soil type, water source, crop rotation history.
2. Crops and seasons. Crop library, season plans, stage tracking, scouting logs.
3. Diesel. Purchase capture with mandatory receipt photo, hour-meter logs, tank reconciliation, variance flags.
4. Repairs. Multi-quote workflow, approval routing, work orders, operator sign-off, warranty windows.
5. Inventory. Inputs, fertilisers, pesticides, parts. FIFO issuance, low-stock alerts.
6. Livestock. Cattle register, vaccination schedule, breeding records, milk yield, feed cost allocation.
7. Labour. Worker register with encrypted CNIC vault, geofenced attendance, piece-rate and day-rate payroll.
8. Procurement. Vendor master, PO workflow, GRN, three-way match.
9. Sales. Buyer master, sales contracts, delivery notes, receivables aging.
10. Finance. Chart of accounts, balanced journals, per-field P&L via computeFieldPnL, cost pool reporting.
11. Compliance. Document vault, expiry tracking, audit trail, 7-year retention.
12. Approvals. Threshold routing with delegation, full context for approvers, GPS-stamped decisions.

## Approval engine highlights

- Bounded state machine: submitted, in-review, approved, rejected, sent-back, expired.
- Threshold-based routing with role-aware escalation.
- Delegation when an approver is unavailable.
- Every action emits an approval_actions audit row.
- Engine lives in packages/approvals/src/engine.ts and is the only path for money-moving writes.

## Field PWA

- Urdu-first RTL shell.
- BigButton home for low-literacy users.
- IndexedDB offline queue with idempotent sync.
- PhotoUploader with client-side compression to 200 KB or less at 1600px long edge.
- Voice input via browser SpeechRecognition (Urdu and English).
- Geofenced clock-in and clock-out.

## Approver PWA

- Passkey login via WebAuthn.
- Cash position shown at decision time.
- Full audit trail per request.
- GPS, IP, and timestamp captured with each decision.
- Multi-quote side-by-side for repair approvals.

## Reports and exports

- Seasonal P&L report (XLSX, CSV, PDF).
- Diesel reconciliation report.
- Labour payroll register.
- Cost pool roll-ups by field and by crop plan.

## Automations and dashboards

- 14 scheduled jobs: digest emails, NDVI placeholder refresh, diesel anomaly scan, document expiry sweep, payroll cut-off, attendance reconciliation, audit retention sweep, R2 replication checks, backup verification, push token cleanup, rate limit reset, cache warm, AI advisor cache prune, calendar sync.
- Dashboards: overview, field activity, diesel trends, open anomalies.

## Monitoring and DR

- Daily Postgres dumps to encrypted volume, weekly off-site replication.
- Cloudflare R2 with multi-region replication for photo evidence.
- /api/diagnostics for health snapshot.
- Job runs persisted to job_runs table with status and duration.

## Known limitations

- Edge cron jobs deferred to Phase 2.
- Satellite NDVI overlay is a placeholder, real integration in Phase 3.
- Pest identification vision model deferred to Phase 3.
- Urdu and Punjabi STT relies on browser API today, no fine-tuned model yet.
- WhatsApp Business dispatcher not yet wired (notify-whatsapp function planned).
- Mapbox field-polygon editor not yet shipped.
- Feasibility study UI not built, data model is in place.

## Phase 2 roadmap

- WhatsApp Business notification dispatcher.
- NDVI satellite overlay on field map.
- Mapbox-based polygon editor.
- Feasibility study UI.
- Edge cron migration where it lowers cost.
- Real Urdu speech-to-text model.
