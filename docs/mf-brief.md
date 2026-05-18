# Zameen — Executive brief

For: MF and family. Audience: financial-director friendly.

## Problem

Rupafab's farm operation runs on paper receipts, WhatsApp voice notes, and shared spreadsheets. Fuel and repair losses are visible only in aggregate. There is no way to compute profit and loss per field, per crop, or per season.

## Solution

Zameen is one mobile-first platform that consolidates the operation.

- Twelve modules: land, crops, diesel, repairs, inventory, livestock, labour, procurement, sales, finance, compliance, approvals.
- Approval-first: every action that moves money, inventory, or asset state routes through the approval engine with audit and GPS capture.
- Field PWA in Urdu, offline-capable, photo and voice capture.
- Approver PWA on phones for the Director with cash position and full context.
- Per-field P&L on demand. Balanced journals for every cost-bearing action.

## Pilot scope

Rupafab Agri, Raiwind, Lahore. Rabi 2025-26 season. 100 acres across 16 fields, 23 worker classes, 14 scheduled jobs.

## Cost

Run on Hetzner CPX31 in Falkenstein (Postgres, app), Supabase free tier (auth, RLS), Cloudflare R2 (photos, first 10 GB free). Projected monthly run cost is approximately Rs. 12,000.

## Risk

1. Operator adoption. Mitigation: shadow workflow alongside paper for one season, training in Urdu, big-button UI on cheap Android handsets.
2. Data residency for compliance. Mitigation: photos in Cloudflare R2 nearest-region, database in Hetzner EU, audit log retained for 7 years on encrypted volume.
3. Single-operator key-person risk. Mitigation: all documentation, runbooks, and infrastructure-as-code checked into the repo; nightly backups to a second region.

## Decision required

None. Phase 1 is live as of 2026-05-18. This brief is informational. Phase 2 scope is reviewed in October 2026.

## Contact

M (Meer Feerasta) - meerfeerasta@gmail.com - agri.feerasta.ai
