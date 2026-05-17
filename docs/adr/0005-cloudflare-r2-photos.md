# ADR 0005, Cloudflare R2 for high-volume photos

Status: Accepted, 2026-04-10.

## Context

Zameen captures photos liberally. Diesel purchase requires a receipt photo. Repair requests carry one or more photos of the failure. Repair invoices carry a photo of the final bill. Crop stage logs carry a photo per stage transition. Harvest records carry photos. Livestock logs carry photos for vet visits and unusual events. The Field PWA compresses each photo to under 200 KB at 1600 px long edge, but the volume is still significant.

Projected volume at Rupafab Agri (Raiwind Farm) (steady state, Phase 1): 30 to 60 photos per active day, average 150 KB each. Annual: roughly 15,000 photos, 2.3 GB net. Phase 2 with three to five additional family farms: 100 to 250 photos per day, 8 to 15 GB annual. Phase 4 with external onboarding: order-of-magnitude higher.

Photo storage has three cost surfaces. First, storage at rest (per GB-month). Second, egress (per GB read). Third, request count (per million PUTs/GETs). Supabase Storage and Cloudflare R2 differ materially on egress; R2 charges zero egress, Supabase Storage charges egress past the included quota.

Photos in Zameen are written once and read sporadically, but the read pattern includes the Approver PWA loading multiple photos for a single decision (diesel receipt, plus the recent similar purchases' receipts), the Ops dashboard rendering field galleries, and reviewers paging through audit history. Egress matters.

## Decision

Use Cloudflare R2 for all high-volume photo storage. Use Supabase Storage for low-volume, document-grade attachments only: entity documents (`zameen-documents`), feasibility study attachments (`zameen-feasibility`), worker CNIC scans (`zameen-worker-docs`).

The R2 path is presigned PUT. The Next.js server signs a 10-minute PUT URL keyed `entities/<entityId>/<module>/<yyyy>/<mm>/<uuid>.jpg`. The client uploads bytes directly to R2. Reads are served via either a signed GET URL (1-hour TTL) generated server-side, or a Cloudflare Worker that authorises the request against the user's Supabase session. R2 buckets have a public-access deny policy.

Lifecycle: objects in R2 are tagged with their `entity_id` and `module`. A weekly job moves objects older than 90 days into Infrequent Access (lower per-GB-month, slightly higher GET cost), which matches the access pattern (photos are dense for the first 90 days of a season, then sparse).

## Consequences

Positive. Egress cost is zero. The Approver PWA can render quote-comparison photo galleries without flinching. Audit reviewers paging through history pay only storage rent. R2's region presence in Europe and the US matches Cloudflare's global edge, which is good for MF's travel context.

Negative. Two storage paths in the codebase. Mitigated by a single `@zameen/storage` module abstraction that picks the path based on bucket name. Two sets of presign logic. Mitigated by reusing the AWS SigV4 utility for both (R2 is S3-compatible). Two billing surfaces; small.

Operational. R2 access keys are stored in Hetzner environment variables and rotated quarterly. R2 has no native virus scan; for Phase 1 we accept the risk on JPEG-only uploads. Phase 3 adds a server-side scan via Cloudflare Workers AI on the PUT trigger.

Failure mode. If R2 is unavailable at upload time, the Field PWA's photo step queues the bytes in IndexedDB along with the form payload and retries on the next online event. The form does not block on photo upload; the photo URL is patched into the row when the upload succeeds. If the upload fails for 24 hours, the row is flagged for manual review.

Exit. If R2 pricing changes adversely or Cloudflare exits R2, the migration path is a one-time copy to Backblaze B2 (also S3-compatible) or AWS S3 with a CloudFront distribution. The presign abstraction insulates the application code.
