# Approval flows

## State machine

```
draft → submit → submitted
submitted → approve → approved
submitted → reject → rejected
submitted → send_back → sent_back
submitted → escalate → in_review
in_review → approve → approved
in_review → reject → rejected
in_review → escalate → in_review        (next role up)
sent_back → submit → submitted
sent_back → reject → rejected
approved → execute → executed
approved → reverse → rejected           (within 24h or director only)
draft → emergency_override → emergency_executed
emergency_executed → approve → executed (post-facto, within 48h)
emergency_executed → reject → rejected
```

Implemented in `packages/approvals/src/state-machine.ts`. Illegal transitions throw `IllegalApprovalTransitionError`.

## Routing rule

For each approval type, thresholds: `{ supervisor, farm_manager, director }`. Amount-based routing:

- `amount <= supervisor cap` → supervisor.
- `amount <= farm_manager cap` → farm manager.
- Otherwise → director.
- If `director: 0` (always-director types like `lease`, `land_transaction`, `loan`, `feasibility_study`) → director immediately, regardless of amount.

Threshold breaches **escalate, not block**. A supervisor trying to approve above their cap auto-routes up to farm manager.

## Per-type defaults (PKR)

| Type | Supervisor | Farm manager | Director |
|---|---:|---:|---:|
| input_purchase | 25,000 | 100,000 | always |
| diesel_purchase | 25,000 | 50,000 | always |
| repair | 10,000 | 50,000 | always |
| asset_purchase | 0 | 0 | always |
| livestock_purchase/sale | 0 | 0 | always |
| crop_sale | 0 | 500,000 | always |
| labor_hire | 0 | 0 | always |
| lease | 0 | 0 | 0 (director-only) |
| capex | 0 | 0 | always |
| land_transaction | 0 | 0 | 0 (director-only) |
| tax_payment | 0 | 0 | always |
| loan | 0 | 0 | 0 (director-only) |
| feasibility_study | 0 | 0 | 0 (director-only) |

Entity-level overrides live in `entity_settings.approval_thresholds`.

## Delegation

`user_entity_roles.delegate_user_id` + `delegation_start` + `delegation_end`. `isDelegationActive(...)` evaluated on each `pickApproverUserId()` call. MF typically delegates to Farm Manager during travel to Lisbon/Detroit.

## Emergency execute

Only `director` or `super_admin`. Transitions `draft → emergency_executed` and stamps justification. A post-facto approval must follow within 48 hours; if missed, MF reviews on his return. State machine still records the eventual `approve` (→ `executed`) or `reject` action for audit closure.

## Reversal

Within 24h: any role at or above the deciding role.
After 24h: director only.

## What the Approver PWA shows

For every request:
- Title, type, amount (with PKR formatter, lac/crore in dashboard mode).
- Requester + recent activity.
- Cash position of the entity at submission time (frozen in `context_snapshot.cashPosition`).
- Recent similar purchases (last 3 same type, same vendor).
- Inventory snapshot for input purchases.
- Quote comparison table for repairs.
- Policy threshold row.
- Photos: receipts for diesel, problem + quote PDFs for repairs.
- Audit trail (every state change with timestamp, actor, role, IP, GPS, comment).
- Four big buttons: Approve, Reject, Send back, Escalate.

WhatsApp notification is a deep link into the corresponding PWA URL with a verification token, not an inline approve/reject.
