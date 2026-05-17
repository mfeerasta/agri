import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb, seedDb, getRows } from '@zameen/db';
import { withApproval } from '../with-approval.js';

const ENTITY = 'entity-1';
const REQUESTER = 'user-requester';

beforeEach(() => {
  resetDb();
  // Seed a director and supervisor under the entity so chain resolution works.
  seedDb({
    users: [
      { id: 'u-dir', fullName: 'Director', primaryRole: 'director', isActive: true },
      { id: 'u-sup', fullName: 'Sup', primaryRole: 'supervisor', isActive: true },
      { id: REQUESTER, fullName: 'Requester', primaryRole: 'farm_manager', isActive: true },
    ],
    userEntityRoles: [
      { id: 'r-dir', userId: 'u-dir', entityId: ENTITY, role: 'director', isActive: true },
      { id: 'r-sup', userId: 'u-sup', entityId: ENTITY, role: 'supervisor', isActive: true },
    ],
  });
});

describe('withApproval', () => {
  it('director self-approves a repair below own cap and executor runs', async () => {
    const executor = vi.fn(async () => ({ ok: true }));
    const res = await withApproval({
      type: 'repair',
      amountPkr: 5_000,
      entityId: ENTITY,
      payload: { foo: 'bar' },
      requestedBy: REQUESTER,
      actorRole: 'director',
      title: 'small repair',
      sourceModule: 'repair',
      executor,
    });

    expect(res.executed).toBe(true);
    expect(executor).toHaveBeenCalledTimes(1);
    const reqs = getRows('approvalRequests');
    expect(reqs).toHaveLength(1);
    expect(reqs[0]!.state).toBe('executed');

    const actions = getRows('approvalActions');
    // submit + approve recorded for the self-approve path.
    expect(actions.some((a) => a.action === 'submit')).toBe(true);
    expect(actions.some((a) => a.action === 'approve')).toBe(true);
  });

  it('supervisor self-approves a diesel purchase within cap', async () => {
    const executor = vi.fn(async () => 'done');
    const res = await withApproval({
      type: 'diesel_purchase',
      amountPkr: 20_000,
      entityId: ENTITY,
      payload: {},
      requestedBy: REQUESTER,
      actorRole: 'supervisor',
      title: 'small diesel',
      sourceModule: 'diesel',
      executor,
    });
    expect(res.executed).toBe(true);
    expect(executor).toHaveBeenCalledOnce();
  });

  it('supervisor above own cap defers — executor not called', async () => {
    const executor = vi.fn(async () => 'nope');
    const res = await withApproval({
      type: 'diesel_purchase',
      amountPkr: 200_000,
      entityId: ENTITY,
      payload: {},
      requestedBy: REQUESTER,
      actorRole: 'supervisor',
      title: 'big diesel',
      sourceModule: 'diesel',
      executor,
    });
    expect(res.executed).toBe(false);
    expect(res.approvalRequestId).toBeDefined();
    expect(executor).not.toHaveBeenCalled();
    const reqs = getRows('approvalRequests');
    expect(reqs[0]!.state).toBe('submitted');
  });

  it('always-director types (lease) never self-approve even for director', async () => {
    const executor = vi.fn(async () => 'leased');
    const res = await withApproval({
      type: 'lease',
      amountPkr: 50_000,
      entityId: ENTITY,
      payload: {},
      requestedBy: REQUESTER,
      actorRole: 'director',
      title: 'lease deal',
      sourceModule: 'lease',
      executor,
    });
    expect(res.executed).toBe(false);
    expect(executor).not.toHaveBeenCalled();
  });

  it('land_transaction always routes regardless of director actor', async () => {
    const executor = vi.fn();
    const res = await withApproval({
      type: 'land_transaction',
      amountPkr: 1_000_000,
      entityId: ENTITY,
      payload: {},
      requestedBy: REQUESTER,
      actorRole: 'director',
      title: 'land buy',
      sourceModule: 'land',
      executor,
    });
    expect(res.executed).toBe(false);
    expect(executor).not.toHaveBeenCalled();
  });
});
