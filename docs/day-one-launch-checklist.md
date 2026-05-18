# Day one launch checklist

For MF. Print, tick, keep. Rabi 2025-26 pilot at Rupafab Agri, Raiwind.

## T minus 7 days

### Accounts and access

- [ ] All accounts created: MF, farm manager, 2 supervisors, 10 workers
- [ ] Each worker has an Android phone with the field PWA installed
- [ ] Phone numbers tested, OTP confirmed working for every user
- [ ] WhatsApp Business templates submitted and approved by Meta
- [ ] MF passkey registered on iPhone
- [ ] MF push notifications enabled for the Approver PWA

### Infrastructure

- [ ] Cloudflare R2 bucket created and tested with one upload from the field PWA
- [ ] Postgres backups verified by restoring a sample dump on a scratch instance
- [ ] Hetzner CPX31 monitoring (CPU, RAM, disk) configured
- [ ] Domains resolving: agri, field, ops, approve, api
- [ ] TLS certificates issued for all four subdomains

### Data setup

- [ ] Opening cash position recorded as a journal entry
- [ ] 16 fields drawn in Mapbox, polygons verified against khasra records
- [ ] Initial crop plans entered for Rabi 2025-26
- [ ] Asset records created: 2 Massey tractors, 1 harvester, 2 tubewells, 1 generator, 1 chaff cutter
- [ ] Fuel storage tank: 5000 litre Main Tank record with opening reading
- [ ] Chart of accounts loaded from seed
- [ ] Vendor master loaded for top 10 vendors
- [ ] Approval workflow thresholds confirmed in `entity_settings`

### Training

- [ ] Worker training session run: each of the 10 walks the 8-step training mode flow
- [ ] Supervisor training session run: each supervisor reads the manual and assigns 3 mock tasks
- [ ] Farm manager training: opens 1 mock approval, approves on the Approver PWA
- [ ] Quick-reference card laminated and posted in the tea room
- [ ] Worker handbooks printed, 1 per worker, distributed
- [ ] Supervisor manual printed, 1 per supervisor

### Communications

- [ ] Worker 90 second video sent on WhatsApp
- [ ] Supervisor 3 minute video sent on WhatsApp
- [ ] MF 1 minute approver video reviewed by MF
- [ ] Pilot launch announcement drafted in Urdu for the WhatsApp group

## Day zero, launch morning

- [ ] 06:00 · MF on site, all workers gathered at the farm office
- [ ] 06:15 · 15-minute live demo by MF, phone in hand, field PWA on the screen
- [ ] 06:30 · First real attendance check-in, each worker individually
- [ ] 06:45 · First real diesel log captured from the morning fill
- [ ] 07:00 · Field work begins
- [ ] 12:00 · Lunch check-in with workers, capture friction points in a notebook
- [ ] 18:00 · End-of-day review: count of logged events vs count of expected events

## Week one (Day 1 to Day 7)

- [ ] Daily WhatsApp digest enabled, sent to MF at 19:30
- [ ] Daily 30 minute friction debrief with farm manager at 19:45
- [ ] One hour MF and farm manager review every Wednesday on platform usage
- [ ] Friday: collect feedback from supervisors and workers, log issues to GitHub
- [ ] Sunday: weekly cost-per-field snapshot reviewed by MF

## Day 30

- [ ] First seasonal cost-per-acre snapshot generated and reviewed
- [ ] First approval throughput report: counts by type, median time to decision
- [ ] Diesel variance trend reviewed
- [ ] Repair turnaround review
- [ ] Decide what to extend, what to fix, what to defer to Phase 2
