import type { ApprovalType, UserRole } from '@zameen/shared';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR, ROLE_RANK } from '@zameen/shared';

export type Thresholds = Record<ApprovalType, { supervisor: number | null; farm_manager: number | null; director: number | null }>;

export interface RoutingInput {
  approvalType: ApprovalType;
  amountPkr: number | null;
  thresholds?: Thresholds;
}

export interface RoutingOutput {
  /** Roles, in escalation order, that must approve. */
  approverChain: UserRole[];
  /** True if even the director must explicitly approve themselves (e.g. land transactions). */
  directorApprovesSelf: boolean;
}

/**
 * Decide the approval chain for a request based on amount and policy.
 *
 * Rule: threshold breaches ESCALATE, never block. If a supervisor tries to
 * approve a request above their limit, it auto-routes to farm_manager.
 */
export function resolveApproverChain(input: RoutingInput): RoutingOutput {
  const t = (input.thresholds ?? DEFAULT_APPROVAL_THRESHOLDS_PKR)[input.approvalType];
  const amount = input.amountPkr ?? 0;

  const supervisorCap = t.supervisor;
  const farmManagerCap = t.farm_manager;

  const alwaysDirector =
    t.director === 0 || (supervisorCap === 0 && farmManagerCap === 0);

  if (alwaysDirector) {
    return { approverChain: ['director'], directorApprovesSelf: true };
  }

  if (supervisorCap !== null && supervisorCap > 0 && amount <= supervisorCap) {
    return { approverChain: ['supervisor'], directorApprovesSelf: false };
  }
  if (farmManagerCap !== null && farmManagerCap > 0 && amount <= farmManagerCap) {
    return { approverChain: ['farm_manager'], directorApprovesSelf: false };
  }
  return { approverChain: ['director'], directorApprovesSelf: false };
}

/** A role can approve everything at or below its rank. */
export function canRoleApprove(actorRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_RANK[actorRole] >= ROLE_RANK[requiredRole];
}

export function nextEscalationTarget(currentRole: UserRole): UserRole | null {
  if (currentRole === 'supervisor') return 'farm_manager';
  if (currentRole === 'farm_manager') return 'director';
  return null;
}
