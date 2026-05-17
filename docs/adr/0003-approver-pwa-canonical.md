# ADR 0003, Approver PWA over WhatsApp inline approve

Status: Accepted, 2026-04-05.

## Context

The Director and Farm Manager personas are mobile-first and intermittently available. The lowest-friction approval channel they already use is WhatsApp. The temptation is to wire approval directly into WhatsApp: a notification arrives with the request summary, the approver replies `YES`, the platform interprets the reply as `approve`, and the underlying transaction executes.

This pattern works at low audit fidelity. It fails at high audit fidelity, which is the platform's value proposition. WhatsApp inline approval has the following problems. First, no GPS at decision time, so an approval claimed to happen at the farm can be issued from anywhere. Second, no IP capture beyond what Meta exposes, which is the WhatsApp Business webhook server, not the approver's device. Third, no rendered context (cash position at submission, quote comparison, inventory snapshot, recent similar purchases) at the moment of decision, which means the approver is deciding from a 200-character text summary. Fourth, spoofing risk: a WhatsApp account with the approver's number, gained via SIM swap or device theft, decides on their behalf with no second factor. Fifth, threading and order: WhatsApp does not guarantee message order, so a reject following an approve, or vice versa, can race.

## Decision

The Approver PWA at `approve.agri.feerasta.ai` is the canonical channel for `approve`, `reject`, `send_back`, and `escalate`. The WhatsApp Business dispatcher (Phase 2) sends notifications only. Each notification carries a deep link of the form `https://approve.agri.feerasta.ai/r/<requestId>?t=<oneTimeToken>`. The token is single-use, 30-minute TTL, and binds to the requestor's phone number for the session.

The dispatcher actively rejects inbound WhatsApp messages that contain `approve`, `reject`, `accept`, or their Urdu equivalents (`منظور`, `مسترد`, `ٹھیک`). The reply to such messages is a templated nudge: "Please tap the link to decide. WhatsApp replies do not count." This is enforced server-side and is non-overridable.

The Approver PWA captures, at decision time, GPS (with 50 m accuracy threshold), IP, user agent, free-text comment in `en`/`ur`/`roman_ur`, and writes a row to `approval_actions` with all four. The state machine in `packages/approvals/src/state-machine.ts` is the only path that mutates `approval_requests.state`.

## Consequences

Positive. Every approval has provable provenance. The audit walk from `journal_lines → journal_entries → diesel_purchases → approval_requests → approval_actions` reaches an actor with GPS and IP. Anti-fraud floor is set: an approval issued from Lisbon while the platform claims it was issued at the farm appears immediately. Director-only types (`lease`, `land_transaction`, `loan`, `feasibility_study`) cannot be socially engineered through a captured WhatsApp account.

Negative. Higher friction at the moment of decision. The approver must tap the link, wait for the PWA to load (under 4 seconds cold target on a Redmi 8A), and make the decision in the app. Some approvers will resist on the first day. Mitigated by clear deep-link push, persistent install prompt after the first decision, and a measurable median time-to-decision SLO (under 6 hours for daytime submissions).

Operational. The Approver PWA must be online-available with high uptime. Hetzner CPX31 plus Cloudflare proxy hits the target. Offline decision capture is not supported on the Approver PWA in Phase 1; the platform shows a clear "you are offline, decision will not save" state.

Exit. If the friction proves unacceptable for an Approver role that cannot adopt the PWA, the fallback is an in-PWA voice approval (capture audio, transcribe, confirm) rather than WhatsApp inline. This stays inside the audit trail.
