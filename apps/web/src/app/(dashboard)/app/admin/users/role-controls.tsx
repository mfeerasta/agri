'use client';

import * as React from 'react';
import { assignRole, revokeRole, inviteAuditor } from './actions';

const ASSIGNABLE_ROLES = [
  'super_admin',
  'director',
  'farm_manager',
  'supervisor',
  'accountant',
  'auditor',
  'worker',
  'viewer',
] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function AssignRoleControl({ userId, currentRoles }: { userId: string; currentRoles: string[] }) {
  const [pending, startTransition] = React.useTransition();
  const [role, setRole] = React.useState<AssignableRole>('viewer');
  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as AssignableRole)}
        className="border border-[var(--rule)] rounded px-2 py-1 text-xs"
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => assignRole({ userId, role }))}
        className="rounded-[6px] border border-[var(--rule)] px-2 py-1 text-xs smallcaps"
      >
        Assign
      </button>
      {currentRoles.includes(role) ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => revokeRole({ userId, role }))}
          className="rounded-[6px] border border-[var(--danger)] text-[var(--danger)] px-2 py-1 text-xs smallcaps"
        >
          Revoke
        </button>
      ) : null}
    </div>
  );
}

export function InviteAuditorForm() {
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  function onSubmit(formData: FormData) {
    setMsg(null);
    startTransition(async () => {
      try {
        await inviteAuditor({ email: String(formData.get('email')) });
        setMsg('Invitation sent.');
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed');
      }
    });
  }
  return (
    <form action={onSubmit} className="flex items-end gap-3">
      <label className="flex flex-col gap-1 text-[0.7rem] smallcaps">
        Auditor email
        <input
          type="email"
          name="email"
          required
          placeholder="ca-firm@example.com"
          className="border border-[var(--rule)] rounded px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[10px] bg-[var(--accent)] text-[var(--paper)] px-3 py-2 text-xs smallcaps"
      >
        {pending ? 'Sending…' : 'Invite read-only'}
      </button>
      {msg ? <span className="text-xs opacity-80">{msg}</span> : null}
    </form>
  );
}
