'use client';
import { useState, useTransition } from 'react';
import { completeRental } from '../../../actions';

export function CompleteRentalForm({ rentalId }: { rentalId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="mt-2 grid gap-2 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await completeRental(rentalId, {
            hoursUsed: Number(fd.get('hoursUsed')) || undefined,
            acresWorked: Number(fd.get('acresWorked')) || undefined,
            fuelChargePkr: Number(fd.get('fuelChargePkr')) || undefined,
            operatorChargePkr: Number(fd.get('operatorChargePkr')) || undefined,
            paidPkr: Number(fd.get('paidPkr')) || undefined,
          });
          setMsg(res.ok ? 'Completed' : res.error);
        });
      }}
    >
      <input name="hoursUsed" type="number" step="0.01" placeholder="hours" className="rounded-sm bg-[var(--paper-2)] p-2 text-xs" />
      <input name="acresWorked" type="number" step="0.001" placeholder="acres" className="rounded-sm bg-[var(--paper-2)] p-2 text-xs" />
      <input name="fuelChargePkr" type="number" step="0.01" placeholder="fuel PKR" className="rounded-sm bg-[var(--paper-2)] p-2 text-xs" />
      <input name="operatorChargePkr" type="number" step="0.01" placeholder="operator PKR" className="rounded-sm bg-[var(--paper-2)] p-2 text-xs" />
      <input name="paidPkr" type="number" step="0.01" placeholder="paid PKR" className="rounded-sm bg-[var(--paper-2)] p-2 text-xs" />
      <button
        type="submit"
        disabled={pending}
        className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-xs text-[var(--paper)]"
      >
        {pending ? 'Closing' : 'Complete and bill'}
      </button>
      {msg && <span className="text-xs text-[var(--zameen-700)]">{msg}</span>}
    </form>
  );
}
