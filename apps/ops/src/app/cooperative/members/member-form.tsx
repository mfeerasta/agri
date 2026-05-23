'use client';
import { useState, useTransition } from 'react';
import { addMember } from '../actions';

export function MemberForm({ cooperatives }: { cooperatives: Array<{ id: string; name: string }> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const crops = String(fd.get('cropsGrown') ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const totalAcres = Number(fd.get('totalAcres'));
        start(async () => {
          const res = await addMember({
            cooperativeId: String(fd.get('cooperativeId')),
            memberName: String(fd.get('memberName')),
            phone: String(fd.get('phone') ?? '') || undefined,
            village: String(fd.get('village') ?? '') || undefined,
            cnic: String(fd.get('cnic') ?? '') || undefined,
            totalAcres: Number.isFinite(totalAcres) && totalAcres > 0 ? totalAcres : undefined,
            cropsGrown: crops.length > 0 ? crops : undefined,
            sharesHeld: Number(fd.get('sharesHeld') ?? 1) || 1,
          });
          setMsg(res.ok ? 'Saved' : res.error);
          if (res.ok) (e.target as HTMLFormElement).reset();
        });
      }}
    >
      <label className="text-xs">
        Cooperative
        <select name="cooperativeId" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm">
          {cooperatives.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Name
        <input name="memberName" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Phone
        <input name="phone" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Village
        <input name="village" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        CNIC
        <input name="cnic" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Total acres
        <input name="totalAcres" type="number" step="0.001" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Crops (comma separated)
        <input name="cropsGrown" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Shares held
        <input name="sharesHeld" type="number" defaultValue={1} className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]"
        >
          {pending ? 'Saving' : 'Onboard member'}
        </button>
        {msg && <span className="text-xs text-[var(--zameen-700)]">{msg}</span>}
      </div>
    </form>
  );
}
