import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb, seedDb, getRows } from '@zameen/db';
import { registerExecutor } from '../execute-on-approval.js';
import { submitApproval, decide } from '../engine.js';

const ENTITY = 'entity-1';
const REQUESTER = 'user-requester';

beforeEach(() => {
  resetDb();
  seedDb({
    users: [
      { id: 'u-dir', fullName: 'Director', primaryRole: 'director', isActive: true },
      { id: REQUESTER, fullName: 'Req', primaryRole: 'supervisor', isActive: true },
    ],
    userEntityRoles: [
      { id: 'r-dir', userId: 'u-dir', entityId: ENTITY, role: 'director', isActive: true },
    ],
  });
});

describe('executeOnApproval', () => {
  it('runs the registered executor and marks state executed', async () => {
    const executor = vi.fn(async (payload: Record<string, unknown>, approvalRequestId: string) => {
      expect(payload).toEqual({ liters: 50 });
      expect(typeof approvalRequestId).toBe('string');
      return { ok: true };
    });
    registerExecutor('diesel_purchase', executor);

    const submitted = await submitApproval({
      entityId: ENTITY,
      approvalType: 'diesel_purchase',
      sourceModule: 'diesel',
      title: 'fill',
      amountPkr: 200_000,
      payload: { liters: 50 },
      requestedBy: REQUESTER,
      actorRole: 'supervisor',
    });

    const decided = await decide({
      approvalRequestId: submitted.id as string,
      actorUserId: 'u-dir',
      actorRole: 'director',
      action: 'approve',
    });

    expect(executor).toHaveBeenCalledOnce();
    expect(decided.state).toBe('executed');
  });

  it('reverts to in_review with a comment row if the executor throws', async () => {
    registerExecutor('input_purchase', async () => {
      throw new Error('boom');
    });

    const submitted = await submitApproval({
      entityId: ENTITY,
      approvalType: 'input_purchase',
      sourceModule: 'inputs',
      title: 'seeds',
      amountPkr: 500_000,
      payload: {},
      requestedBy: REQUESTER,
      actorRole: 'supervisor',
    });

    const decided = await decide({
      approvalRequestId: submitted.id as string,
      actorUserId: 'u-dir',
      actorRole: 'director',
      action: 'approve',
    });

    expect(decided.state).toBe('in_review');
    const actions = getRows('approvalActions');
    const comments = actions.filter((a) => a.action === 'comment');
    expect(comments.length).toBeGreaterThan(0);
    expect(String(comments[comments.length - 1]!.comment)).toMatch(/executor failed/);
  });
});
