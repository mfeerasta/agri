'use client';
import { useState, useTransition } from 'react';
import { addPledge } from '../../actions';

export function PledgeForm({
  poolId,
  members,
  unit,
}: {
  poolId: string;
  members: Array<{ id: string; name: string }>;
  unit: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await addPledge({
            poolId,
            memberId: String(fd.get('memberId')),
            pledgedQuantity: Number(fd.get('pledgedQuantity')),
            pledgeAmountPkr: Number(fd.get('pledgeAmountPkr')) || undefined,
          });
          setMsg(res.ok ? 'Pledged' : res.error);
          if (res.ok) (e.target as HTMLFormElement).reset();
        });
      }}
    >
      <label className="text-xs">
        Member
        <select name="memberId" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm">
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Quantity ({unit})
        <input name="pledgedQuantity" type="number" step="0.0001" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Pledge amount (PKR)
        <input name="pledgeAmountPkr" type="number" step="0.01" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <div className="md:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]"
        >
          {pending ? 'Adding' : 'Add pledge'}
        </button>
        {msg && <span className="text-xs text-[var(--zameen-700)]">{msg}</span>}
      </div>
    </form>
  );
}
