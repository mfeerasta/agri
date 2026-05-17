import { describe, it, expect } from 'vitest';
import {
  resolveApproverChain,
  canRoleApprove,
  nextEscalationTarget,
} from '../routing.js';

describe('resolveApproverChain', () => {
  it('input_purchase Rs 20k routes to supervisor', () => {
    const r = resolveApproverChain({ approvalType: 'input_purchase', amountPkr: 20_000 });
    expect(r.approverChain).toEqual(['supervisor']);
    expect(r.directorApprovesSelf).toBe(false);
  });

  it('input_purchase Rs 30k escalates past supervisor to farm_manager', () => {
    const r = resolveApproverChain({ approvalType: 'input_purchase', amountPkr: 30_000 });
    expect(r.approverChain).toEqual(['farm_manager']);
  });

  it('input_purchase Rs 25k (boundary) stays at supervisor', () => {
    const r = resolveApproverChain({ approvalType: 'input_purchase', amountPkr: 25_000 });
    expect(r.approverChain).toEqual(['supervisor']);
  });

  it('input_purchase above farm_manager cap (Rs 200k) routes to director', () => {
    const r = resolveApproverChain({ approvalType: 'input_purchase', amountPkr: 200_000 });
    expect(r.approverChain).toEqual(['director']);
  });

  it.each(['lease', 'land_transaction', 'loan', 'feasibility_study'] as const)(
    '%s always routes to director regardless of amount',
    (type) => {
      const small = resolveApproverChain({ approvalType: type, amountPkr: 1_000 });
      const huge = resolveApproverChain({ approvalType: type, amountPkr: 50_000_000 });
      expect(small.approverChain).toEqual(['director']);
      expect(huge.approverChain).toEqual(['director']);
      expect(small.directorApprovesSelf).toBe(true);
      expect(huge.directorApprovesSelf).toBe(true);
    },
  );

  it('escalate-never-block: amount above all caps still routes (never returns empty chain)', () => {
    const r = resolveApproverChain({ approvalType: 'diesel_purchase', amountPkr: 10_000_000 });
    expect(r.approverChain.length).toBeGreaterThan(0);
    expect(r.approverChain).toEqual(['director']);
  });

  it('null amount routes to director by default', () => {
    const r = resolveApproverChain({ approvalType: 'diesel_purchase', amountPkr: null });
    expect(r.approverChain).toEqual(['director']);
  });
});

describe('canRoleApprove rank logic', () => {
  it('director can approve supervisor-level', () => {
    expect(canRoleApprove('director', 'supervisor')).toBe(true);
  });
  it('director can approve director-level', () => {
    expect(canRoleApprove('director', 'director')).toBe(true);
  });
  it('supervisor cannot approve director-level', () => {
    expect(canRoleApprove('supervisor', 'director')).toBe(false);
  });
  it('worker cannot approve supervisor-level', () => {
    expect(canRoleApprove('worker', 'supervisor')).toBe(false);
  });
  it('super_admin tops the ranking', () => {
    expect(canRoleApprove('super_admin', 'director')).toBe(true);
  });
  it('farm_manager can approve supervisor-level', () => {
    expect(canRoleApprove('farm_manager', 'supervisor')).toBe(true);
  });
});

describe('nextEscalationTarget boundary cases', () => {
  it('supervisor -> farm_manager', () => {
    expect(nextEscalationTarget('supervisor')).toBe('farm_manager');
  });
  it('farm_manager -> director', () => {
    expect(nextEscalationTarget('farm_manager')).toBe('director');
  });
  it('director -> null (cannot escalate above)', () => {
    expect(nextEscalationTarget('director')).toBeNull();
  });
  it('super_admin -> null', () => {
    expect(nextEscalationTarget('super_admin')).toBeNull();
  });
  it('worker -> null (no escalation path)', () => {
    expect(nextEscalationTarget('worker')).toBeNull();
  });
});
