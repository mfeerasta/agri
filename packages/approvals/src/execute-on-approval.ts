/**
 * Registry of post-approval executors.
 *
 * Hold-then-execute is the platform's safety pillar: server actions don't
 * write money/inventory/asset state directly. They submit a request, and the
 * actual mutation runs only after `decide()` reaches `approved`. Modules
 * register their executor at import time; the engine looks it up by
 * approval type and runs it once the state machine allows it.
 */

import { eq } from 'drizzle-orm';
import { db, approvalRequests } from '@zameen/db';
import type { ApprovalType } from '@zameen/shared';

export type ApprovalExecutor<TPayload = Record<string, unknown>, TResult = unknown> = (
  payload: TPayload,
  approvalRequestId: string,
) => Promise<TResult>;

const REGISTRY = new Map<ApprovalType, ApprovalExecutor>();

/**
 * Register the executor for an approval type. Modules call this at top-level
 * import so the engine can resolve a callback the moment a decision lands.
 */
export function registerExecutor<TPayload, TResult>(
  type: ApprovalType,
  fn: ApprovalExecutor<TPayload, TResult>,
): void {
  REGISTRY.set(type, fn as ApprovalExecutor);
}

export function getExecutor(type: ApprovalType): ApprovalExecutor | undefined {
  return REGISTRY.get(type);
}

export interface ExecuteResult {
  executed: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Invoke the executor for a now-approved request. Errors are caught and
 * surfaced to the caller so the engine can revert state to `in_review`,
 * preserving the invariant that an `executed` row always has real side
 * effects behind it.
 */
export async function executeOnApproval(approvalRequestId: string): Promise<ExecuteResult> {
  const [req] = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, approvalRequestId))
    .limit(1);
  if (!req) return { executed: false, error: 'request not found' };
  if (req.state !== 'approved') return { executed: false, error: `state ${req.state} not approved` };

  const fn = getExecutor(req.approvalType as ApprovalType);
  if (!fn) return { executed: false, error: `no executor for ${req.approvalType}` };

  try {
    const result = await fn(req.payload as Record<string, unknown>, req.id);
    const payload = (req.payload as Record<string, unknown>) ?? {};
    payload.executedResult = result as never;
    await db
      .update(approvalRequests)
      .set({ state: 'executed', payload, executedAt: new Date(), updatedAt: new Date() })
      .where(eq(approvalRequests.id, req.id));
    return { executed: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { executed: false, error: message };
  }
}
