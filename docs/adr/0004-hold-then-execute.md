# ADR 0004, Hold-then-execute approval pattern

Status: Accepted, 2026-04-06.

## Context

A platform that records cash movements, inventory deductions, and asset state changes must decide when those side effects fire relative to approval. Two patterns are common.

The first is optimistic execute: the user submits, the platform executes immediately (deducts inventory, posts the journal, marks the asset retired), and an approval runs in parallel. If approval fails, the platform compensates with a reversing entry. This is low-friction and matches how paper-based farms operate today (the supervisor issues diesel, the manager hears about it at the end of the day).

The second is hold-then-execute: the user submits, the platform creates a request and waits, the approver acts, and only on `approved` does the platform commit side effects to inventory, cash, and asset state. This is higher friction at the moment of submission but produces a clean audit trail with no reversing entries on the hot path.

Zameen's value proposition is audit fidelity. Reversing entries multiply the audit graph (every commit has a possible compensating shadow) and create reconciliation noise for the Accountant. Worse, reversal on inventory after the item has been physically consumed (diesel issued from the tank into the tractor) is impossible; the platform would carry a phantom positive balance until manual correction.

## Decision

Every cost-bearing or asset-touching mutation follows hold-then-execute. The flow is:

1. Worker, supervisor, or manager submits a draft transaction (a `diesel_purchases` row, a `repair_requests` row, an `input_issuances` row). The row carries `approval_request_id` pointing to a newly created `approval_requests` row in state `submitted`. No inventory deduction. No journal entry. No asset state change.
2. The approval engine routes to the first approver per threshold. The approver acts in the Approver PWA. State transitions through the bounded machine in `packages/approvals/src/state-machine.ts`.
3. On `approved`, an `execute` action transitions to `executed` and the platform fires the side effects in one transaction: inventory deduction, journal posting, cost allocation, asset state update.
4. Director approvals on their own requests still write a complete `approval_actions` audit row. Director is not exempt from the trail; director is exempt only from the wait.

There is no submit-and-execute path for non-director actors. There is no silent commit anywhere in the codebase. Emergency execute exists (`draft → emergency_executed`) for director or super_admin only, with mandatory justification and a 48-hour post-facto approval window.

## Consequences

Positive. Audit walk is one-directional, no compensation shadows. Inventory and cash positions reflect approved reality, not provisional reality. Reconciliation by the Accountant is straightforward. The approver sees a meaningful cash position at decision time because nothing has moved yet.

Negative. Friction at submission. A supervisor cannot self-issue diesel without supervisor approval (their own role suffices when amount is under their cap, but the request still passes through the state machine and writes audit). The worker waits for an answer before consuming the diesel; in practice the supervisor approves while standing next to the worker. Field testing at AGRI confirms this is acceptable on the worker-supervisor pair; for higher-amount transactions the wait is the point.

Operational. Background jobs that need to run on `approved` (notify WhatsApp, write to external arhti integration in Phase 4) attach to `LISTEN/NOTIFY` channels emitted by the state-machine update trigger. No polling.

Edge cases. Emergency execute covers the rare case where waiting is harmful (vet emergency, broken irrigation during peak watering). The platform marks the transaction `emergency_executed` and requires director sign-off within 48 hours; missed sign-off escalates to MF on his next session login.

Exit. If the friction proves unacceptable for a class of low-value, high-frequency transactions, we introduce an auto-approval workflow row (e.g. small attendance corrections) where the approval is auto-acted on submission. The state-machine path is still walked; the audit row still writes. Today, no such class exists.
