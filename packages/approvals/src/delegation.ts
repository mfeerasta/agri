export interface ActiveDelegation {
  delegateUserId: string;
  start: Date;
  end: Date;
}

export function isDelegationActive(d: ActiveDelegation | null | undefined, now: Date = new Date()): boolean {
  if (!d) return false;
  return now >= d.start && now <= d.end;
}

export function resolveEffectiveApprover(
  primaryUserId: string,
  delegation: ActiveDelegation | null,
  now: Date = new Date(),
): string {
  return isDelegationActive(delegation, now) && delegation ? delegation.delegateUserId : primaryUserId;
}
