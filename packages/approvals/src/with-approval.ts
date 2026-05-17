/**
 * Hold-then-execute wrapper. The canonical entry point for any server action
 * that touches money, inventory, or asset state.
 *
 * Two paths:
 *  1. Actor's role cap (resolved via `entity_settings.approval_thresholds`)
 *     already permits the amount. Executor runs immediately and a synthetic
 *     auto-approved request is written for audit.
 *  2. Otherwise the request is submitted, currentApproverId is set, and the
 *     executor will fire later through `executeOnApproval` when the chain
 *     concludes with `approved`.
 */

import { eq } from 'drizzle-orm';
import { db, approvalRequests, approvalActions, entitySettings } from '@zameen/db';
import type { ApprovalType, UserRole } from '@zameen/shared';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { submitApproval } from './engine.js';
import { resolveApproverChain, canRoleApprove, type Thresholds } from './routing.js';
import { registerExecutor } from './execute-on-approval.js';
import type { ApprovalContextSnapshot } from './context.js';

export interface WithApprovalInput<TPayload, TResult> {
  type: ApprovalType;
  amountPkr?: number;
  entityId: string;
  payload: TPayload;
  requestedBy: string;
  actorRole: UserRole;
  title: string;
  titleUr?: string;
  sourceModule: string;
  sourceRecordId?: string;
  contextBuilder?: (payload: TPayload) => Promise<ApprovalContextSnapshot>;
  executor: (payload: TPayload, approvalRequestId: string) => Promise<TResult>;
  actorIp?: string;
  actorUserAgent?: string;
}

export interface WithApprovalResult<TResult> {
  executed: boolean;
  result?: TResult;
  approvalRequestId?: string;
}

async function loadThresholds(entityId: string): Promise<Thresholds | undefined> {
  const [s] = await db.select().from(entitySettings).where(eq(entitySettings.entityId, entityId)).limit(1);
  return (s?.approvalThresholds as Thresholds | undefined) ?? undefined;
}

function canSelfApprove(actorRole: UserRole, requiredRole: UserRole): boolean {
  return canRoleApprove(actorRole, requiredRole);
}

/**
 * Wrap a mutation in the approval gate. Always register the matching executor
 * with `registerExecutor` so deferred-path requests can complete after a
 * decision is recorded.
 */
export async function withApproval<TPayload, TResult>(
  input: WithApprovalInput<TPayload, TResult>,
): Promise<WithApprovalResult<TResult>> {
  // Always register the executor so the deferred path can find it.
  registerExecutor(input.type, async (p, id) => input.executor(p as TPayload, id));

  const thresholds = (await loadThresholds(input.entityId)) ?? (DEFAULT_APPROVAL_THRESHOLDS_PKR as unknown as Thresholds);
  const { approverChain } = resolveApproverChain({
    approvalType: input.type,
    amountPkr: input.amountPkr ?? null,
    thresholds,
  });
  const requiredRole = approverChain[0]!;

  // Director-approves-self approval types (e.g. land, lease, feasibility) must
  // always route, even if the actor outranks. We treat threshold=0 across the
  // board as the marker: re-resolve and force submission.
  const t = thresholds[input.type];
  const alwaysRoute = t.director === 0 || (t.supervisor === 0 && t.farm_manager === 0 && t.director === 0);

  if (!alwaysRoute && canSelfApprove(input.actorRole, requiredRole)) {
    // Path 1: self-approve. Record audit, then execute.
    const contextSnapshot = input.contextBuilder ? await input.contextBuilder(input.payload) : null;
    const [created] = await db
      .insert(approvalRequests)
      .values({
        entityId: input.entityId,
        approvalType: input.type,
        state: 'executed',
        sourceModule: input.sourceModule,
        sourceRecordId: input.sourceRecordId,
        title: input.title,
        titleUr: input.titleUr,
        amountPkr: input.amountPkr != null ? input.amountPkr.toString() : null,
        payload: input.payload as Record<string, unknown>,
        contextSnapshot,
        requestedBy: input.requestedBy,
        currentApproverId: null,
        submittedAt: new Date(),
        decidedAt: new Date(),
        executedAt: new Date(),
      })
      .returning();
    if (!created) throw new Error('Failed to record self-approval');

    await db.insert(approvalActions).values([
      {
        approvalRequestId: created.id,
        action: 'submit',
        actorId: input.requestedBy,
        actorRole: input.actorRole,
        fromState: 'draft',
        toState: 'submitted',
        comment: 'auto-approved within actor role cap',
        ipAddress: input.actorIp,
        userAgent: input.actorUserAgent,
      },
      {
        approvalRequestId: created.id,
        action: 'approve',
        actorId: input.requestedBy,
        actorRole: input.actorRole,
        fromState: 'submitted',
        toState: 'approved',
        comment: 'auto-approved within actor role cap',
        ipAddress: input.actorIp,
        userAgent: input.actorUserAgent,
      },
    ]);

    const result = await input.executor(input.payload, created.id);
    const updatedPayload = { ...(input.payload as Record<string, unknown>), executedResult: result as never };
    await db.update(approvalRequests).set({ payload: updatedPayload, updatedAt: new Date() }).where(eq(approvalRequests.id, created.id));
    return { executed: true, result, approvalRequestId: created.id };
  }

  // Path 2: defer. Submit, executor will fire on approval.
  const contextSnapshot = input.contextBuilder ? await input.contextBuilder(input.payload) : undefined;
  const req = await submitApproval({
    entityId: input.entityId,
    approvalType: input.type,
    sourceModule: input.sourceModule,
    sourceRecordId: input.sourceRecordId,
    title: input.title,
    titleUr: input.titleUr,
    amountPkr: input.amountPkr,
    payload: input.payload as Record<string, unknown>,
    contextSnapshot,
    requestedBy: input.requestedBy,
    actorRole: input.actorRole,
    actorIp: input.actorIp,
    actorUserAgent: input.actorUserAgent,
  });
  return { executed: false, approvalRequestId: req.id };
}
