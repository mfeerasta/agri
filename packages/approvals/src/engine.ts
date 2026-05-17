import { eq, and } from 'drizzle-orm';
import {
  db,
  approvalRequests,
  approvalActions,
  approvalWorkflows,
  userEntityRoles,
  entitySettings,
} from '@zameen/db';
import type { ApprovalRequest, NewApprovalRequest } from '@zameen/db/types';
import { APPROVAL_REVERSAL_WINDOW_HOURS, type ApprovalType, type UserRole } from '@zameen/shared';
import { nextState, type ApprovalAction, type ApprovalState } from './state-machine.js';
import { canRoleApprove, nextEscalationTarget, resolveApproverChain, type Thresholds } from './routing.js';
import { isDelegationActive } from './delegation.js';
import type { ApprovalContextSnapshot } from './context.js';
import { executeOnApproval } from './execute-on-approval.js';
import { notifyApprovalEvent } from './notify.js';

export interface SubmitInput {
  entityId: string;
  approvalType: ApprovalType;
  sourceModule: string;
  sourceRecordId?: string;
  title: string;
  titleUr?: string;
  amountPkr?: number;
  payload: Record<string, unknown>;
  contextSnapshot?: ApprovalContextSnapshot;
  requestedBy: string;
  actorRole: UserRole;
  actorIp?: string;
  actorUserAgent?: string;
}

export interface DecisionInput {
  approvalRequestId: string;
  actorUserId: string;
  actorRole: UserRole;
  action: Extract<ApprovalAction, 'approve' | 'reject' | 'send_back' | 'escalate' | 'comment'>;
  comment?: string;
  commentUr?: string;
  gpsLocation?: { lat: number; lng: number; accuracyM?: number };
  actorIp?: string;
  actorUserAgent?: string;
}

export interface EmergencyExecuteInput {
  approvalRequestId: string;
  actorUserId: string;
  actorRole: UserRole;
  justification: string;
}

async function loadThresholds(entityId: string): Promise<Thresholds | undefined> {
  const [s] = await db.select().from(entitySettings).where(eq(entitySettings.entityId, entityId)).limit(1);
  return (s?.approvalThresholds as Thresholds | undefined) ?? undefined;
}

async function pickApproverUserId(entityId: string, requiredRole: UserRole): Promise<string | null> {
  const rows = await db
    .select()
    .from(userEntityRoles)
    .where(and(eq(userEntityRoles.entityId, entityId), eq(userEntityRoles.role, requiredRole), eq(userEntityRoles.isActive, true)));
  const now = new Date();
  for (const r of rows) {
    const delegation =
      r.delegateUserId && r.delegationStart && r.delegationEnd
        ? { delegateUserId: r.delegateUserId, start: new Date(r.delegationStart), end: new Date(r.delegationEnd) }
        : null;
    return isDelegationActive(delegation, now) && delegation ? delegation.delegateUserId : r.userId;
  }
  return null;
}

export async function submitApproval(input: SubmitInput): Promise<ApprovalRequest> {
  const thresholds = await loadThresholds(input.entityId);
  const { approverChain } = resolveApproverChain({
    approvalType: input.approvalType,
    amountPkr: input.amountPkr ?? null,
    thresholds,
  });
  const firstApproverRole = approverChain[0]!;
  const firstApproverUserId = await pickApproverUserId(input.entityId, firstApproverRole);

  const [wf] = await db
    .select()
    .from(approvalWorkflows)
    .where(
      and(
        eq(approvalWorkflows.entityId, input.entityId),
        eq(approvalWorkflows.approvalType, input.approvalType),
        eq(approvalWorkflows.isActive, true),
      ),
    )
    .limit(1);

  const insert: NewApprovalRequest = {
    entityId: input.entityId,
    approvalType: input.approvalType,
    workflowId: wf?.id,
    state: 'submitted',
    sourceModule: input.sourceModule,
    sourceRecordId: input.sourceRecordId,
    title: input.title,
    titleUr: input.titleUr,
    amountPkr: input.amountPkr != null ? input.amountPkr.toString() : null,
    payload: input.payload,
    contextSnapshot: input.contextSnapshot ?? null,
    requestedBy: input.requestedBy,
    currentApproverId: firstApproverUserId,
    submittedAt: new Date(),
  };
  const [created] = await db.insert(approvalRequests).values(insert).returning();
  if (!created) throw new Error('Failed to create approval request');

  await db.insert(approvalActions).values({
    approvalRequestId: created.id,
    action: 'submit',
    actorId: input.requestedBy,
    actorRole: input.actorRole,
    fromState: 'draft',
    toState: 'submitted',
    comment: null,
    ipAddress: input.actorIp,
    userAgent: input.actorUserAgent,
  });

  await notifyApprovalEvent({ request: created, event: 'submitted' }).catch(() => undefined);

  return created;
}

export async function decide(input: DecisionInput): Promise<ApprovalRequest> {
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, input.approvalRequestId)).limit(1);
  if (!req) throw new Error('Approval request not found');

  const requiredRoleFromChain: UserRole = req.amountPkr
    ? resolveApproverChain({
        approvalType: req.approvalType as ApprovalType,
        amountPkr: Number(req.amountPkr),
        thresholds: (await loadThresholds(req.entityId)) ?? undefined,
      }).approverChain[0]!
    : 'farm_manager';

  if (input.action !== 'comment' && !canRoleApprove(input.actorRole, requiredRoleFromChain)) {
    throw new Error(`Role ${input.actorRole} cannot act on a request requiring ${requiredRoleFromChain}`);
  }

  const fromState = req.state as ApprovalState;
  const toState = nextState(fromState, input.action);

  let newApproverUserId: string | null = req.currentApproverId;
  if (input.action === 'escalate') {
    const escalateTo = nextEscalationTarget(requiredRoleFromChain);
    if (!escalateTo) throw new Error('Cannot escalate beyond director');
    newApproverUserId = await pickApproverUserId(req.entityId, escalateTo);
  }
  if (toState === 'approved' || toState === 'rejected' || toState === 'sent_back') {
    newApproverUserId = null;
  }

  const [updated] = await db
    .update(approvalRequests)
    .set({
      state: toState,
      currentApproverId: newApproverUserId,
      decidedAt: toState === 'approved' || toState === 'rejected' ? new Date() : req.decidedAt,
      updatedAt: new Date(),
    })
    .where(eq(approvalRequests.id, req.id))
    .returning();

  await db.insert(approvalActions).values({
    approvalRequestId: req.id,
    action: input.action,
    actorId: input.actorUserId,
    actorRole: input.actorRole,
    fromState,
    toState,
    comment: input.comment,
    commentUr: input.commentUr,
    ipAddress: input.actorIp,
    userAgent: input.actorUserAgent,
    gpsLocation: input.gpsLocation,
  });

  // Side effects after the audit row lands: notify the right audience, then
  // if approved try to execute the registered side-effect. Revert to
  // in_review with a comment if the executor throws, so the audit log shows
  // exactly why nothing happened.
  let finalRequest = updated!;
  if (toState === 'approved') {
    const exec = await executeOnApproval(req.id);
    if (!exec.executed) {
      const [reverted] = await db
        .update(approvalRequests)
        .set({ state: 'in_review', updatedAt: new Date() })
        .where(eq(approvalRequests.id, req.id))
        .returning();
      await db.insert(approvalActions).values({
        approvalRequestId: req.id,
        action: 'comment',
        actorId: input.actorUserId,
        actorRole: input.actorRole,
        fromState: 'approved',
        toState: 'in_review',
        comment: `executor failed: ${exec.error ?? 'unknown'}`,
      });
      finalRequest = reverted ?? finalRequest;
    } else {
      const [executed] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, req.id)).limit(1);
      finalRequest = executed ?? finalRequest;
    }
  }

  const event =
    toState === 'approved'
      ? 'approved'
      : toState === 'rejected'
        ? 'rejected'
        : toState === 'sent_back'
          ? 'sent_back'
          : null;
  if (event) {
    await notifyApprovalEvent({ request: finalRequest, event, comment: input.comment }).catch(() => undefined);
  }

  return finalRequest;
}

export async function emergencyExecute(input: EmergencyExecuteInput): Promise<ApprovalRequest> {
  if (input.actorRole !== 'director' && input.actorRole !== 'super_admin') {
    throw new Error('Only director may emergency-execute');
  }
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, input.approvalRequestId)).limit(1);
  if (!req) throw new Error('Approval request not found');

  const fromState = req.state as ApprovalState;
  const toState = nextState(fromState, 'emergency_override');
  const [updated] = await db
    .update(approvalRequests)
    .set({
      state: toState,
      emergencyExecuted: true,
      emergencyJustification: input.justification,
      executedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(approvalRequests.id, req.id))
    .returning();

  await db.insert(approvalActions).values({
    approvalRequestId: req.id,
    action: 'emergency_override',
    actorId: input.actorUserId,
    actorRole: input.actorRole,
    fromState,
    toState,
    comment: input.justification,
  });

  return updated!;
}

export async function reverse(
  approvalRequestId: string,
  actorUserId: string,
  actorRole: UserRole,
  reason: string,
): Promise<ApprovalRequest> {
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, approvalRequestId)).limit(1);
  if (!req) throw new Error('Approval request not found');
  const hoursSinceDecision = req.decidedAt
    ? (Date.now() - new Date(req.decidedAt).getTime()) / 3_600_000
    : Infinity;
  if (hoursSinceDecision > APPROVAL_REVERSAL_WINDOW_HOURS && actorRole !== 'director' && actorRole !== 'super_admin') {
    throw new Error('Past 24h reversal window — only director may reverse');
  }

  const fromState = req.state as ApprovalState;
  const toState = nextState(fromState, 'reverse');
  const [updated] = await db
    .update(approvalRequests)
    .set({ state: toState, reversedAt: new Date(), reversedBy: actorUserId, updatedAt: new Date() })
    .where(eq(approvalRequests.id, req.id))
    .returning();
  await db.insert(approvalActions).values({
    approvalRequestId: req.id,
    action: 'reverse',
    actorId: actorUserId,
    actorRole,
    fromState,
    toState,
    comment: reason,
  });
  return updated!;
}
