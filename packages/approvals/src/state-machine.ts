/**
 * Approval state machine.
 *
 * State transitions are bounded — we never silently mutate state. All
 * decisions go through `transition()`, which fails fast for illegal moves.
 */

export type ApprovalState =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'executed'
  | 'closed'
  | 'emergency_executed';

export type ApprovalAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'send_back'
  | 'escalate'
  | 'delegate'
  | 'execute'
  | 'reverse'
  | 'emergency_override'
  | 'comment';

const TRANSITIONS: Record<ApprovalState, Partial<Record<ApprovalAction, ApprovalState>>> = {
  draft: { submit: 'submitted', emergency_override: 'emergency_executed' },
  submitted: {
    approve: 'approved',
    reject: 'rejected',
    send_back: 'sent_back',
    escalate: 'in_review',
    delegate: 'submitted',
    comment: 'submitted',
  },
  in_review: {
    approve: 'approved',
    reject: 'rejected',
    send_back: 'sent_back',
    escalate: 'in_review',
    delegate: 'in_review',
    comment: 'in_review',
  },
  sent_back: { submit: 'submitted', reject: 'rejected' },
  approved: { execute: 'executed', reverse: 'rejected', comment: 'approved' },
  rejected: { comment: 'rejected' },
  executed: { reverse: 'rejected', comment: 'executed' },
  emergency_executed: { approve: 'executed', reject: 'rejected', comment: 'emergency_executed' },
  closed: {},
};

export class IllegalApprovalTransitionError extends Error {
  constructor(public from: ApprovalState, public action: ApprovalAction) {
    super(`Cannot apply ${action} on state ${from}`);
  }
}

export function nextState(from: ApprovalState, action: ApprovalAction): ApprovalState {
  const to = TRANSITIONS[from]?.[action];
  if (!to) throw new IllegalApprovalTransitionError(from, action);
  return to;
}

export function canTransition(from: ApprovalState, action: ApprovalAction): boolean {
  return Boolean(TRANSITIONS[from]?.[action]);
}

export const TERMINAL_STATES: readonly ApprovalState[] = ['rejected', 'closed'];

export function isTerminal(s: ApprovalState): boolean {
  return TERMINAL_STATES.includes(s);
}
