import { describe, it, expect } from 'vitest';
import {
  nextState,
  canTransition,
  isTerminal,
  IllegalApprovalTransitionError,
  type ApprovalState,
  type ApprovalAction,
} from '../state-machine.js';

const LEGAL: Array<[ApprovalState, ApprovalAction, ApprovalState]> = [
  ['draft', 'submit', 'submitted'],
  ['draft', 'emergency_override', 'emergency_executed'],
  ['submitted', 'approve', 'approved'],
  ['submitted', 'reject', 'rejected'],
  ['submitted', 'send_back', 'sent_back'],
  ['submitted', 'escalate', 'in_review'],
  ['submitted', 'delegate', 'submitted'],
  ['submitted', 'comment', 'submitted'],
  ['in_review', 'approve', 'approved'],
  ['in_review', 'reject', 'rejected'],
  ['in_review', 'send_back', 'sent_back'],
  ['in_review', 'escalate', 'in_review'],
  ['in_review', 'delegate', 'in_review'],
  ['in_review', 'comment', 'in_review'],
  ['sent_back', 'submit', 'submitted'],
  ['sent_back', 'reject', 'rejected'],
  ['approved', 'execute', 'executed'],
  ['approved', 'reverse', 'rejected'],
  ['approved', 'comment', 'approved'],
  ['rejected', 'comment', 'rejected'],
  ['executed', 'reverse', 'rejected'],
  ['executed', 'comment', 'executed'],
  ['emergency_executed', 'approve', 'executed'],
  ['emergency_executed', 'reject', 'rejected'],
  ['emergency_executed', 'comment', 'emergency_executed'],
];

const ILLEGAL: Array<[ApprovalState, ApprovalAction]> = [
  ['draft', 'approve'],
  ['draft', 'reject'],
  ['submitted', 'execute'],
  ['approved', 'submit'],
  ['rejected', 'approve'],
  ['rejected', 'submit'],
  ['closed', 'submit'],
  ['closed', 'comment'],
  ['executed', 'submit'],
];

describe('approval state machine', () => {
  describe('legal transitions', () => {
    it.each(LEGAL)('%s + %s -> %s', (from, action, expected) => {
      expect(nextState(from, action)).toBe(expected);
      expect(canTransition(from, action)).toBe(true);
    });
  });

  describe('illegal transitions throw', () => {
    it.each(ILLEGAL)('%s + %s throws', (from, action) => {
      expect(() => nextState(from, action)).toThrow(IllegalApprovalTransitionError);
      expect(canTransition(from, action)).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('rejected is terminal', () => {
      expect(isTerminal('rejected')).toBe(true);
    });
    it('closed is terminal', () => {
      expect(isTerminal('closed')).toBe(true);
    });
    it.each<ApprovalState>([
      'draft',
      'submitted',
      'in_review',
      'sent_back',
      'approved',
      'executed',
      'emergency_executed',
    ])('%s is not terminal', (s) => {
      expect(isTerminal(s)).toBe(false);
    });
  });

  describe('emergency execute path', () => {
    it('draft can emergency_override to emergency_executed', () => {
      expect(nextState('draft', 'emergency_override')).toBe('emergency_executed');
    });
    it('emergency_executed can be ratified via approve', () => {
      expect(nextState('emergency_executed', 'approve')).toBe('executed');
    });
    it('emergency_executed can still be rejected', () => {
      expect(nextState('emergency_executed', 'reject')).toBe('rejected');
    });
  });

  it('IllegalApprovalTransitionError carries context', () => {
    try {
      nextState('rejected', 'approve');
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalApprovalTransitionError);
      expect((e as IllegalApprovalTransitionError).from).toBe('rejected');
      expect((e as IllegalApprovalTransitionError).action).toBe('approve');
    }
  });
});
