'use client';
import { useState, useTransition } from 'react';
import { bookRental } from '../../../actions';

export function BookingForm({ arrangementId }: { arrangementId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await bookRental({
            arrangementId,
            renterName: String(fd.get('renterName') ?? '') || undefined,
            renterPhone: String(fd.get('renterPhone') ?? '') || undefined,
            startAt: String(fd.get('startAt')),
            endAt: String(fd.get('endAt') ?? '') || undefined,
          });
          setMsg(res.ok ? 'Booked' : res.error);
          if (res.ok) (e.target as HTMLFormElement).reset();
        });
      }}
    >
      <label className="text-xs">
        Renter name
        <input name="renterName" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Renter phone
        <input name="renterPhone" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <span />
      <label className="text-xs">
        Start
        <input name="startAt" type="datetime-local" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        End (optional)
        <input name="endAt" type="datetime-local" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <div className="flex items-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]"
        >
          {pending ? 'Booking' : 'Book'}
        </button>
        {msg && <span className="text-xs text-[var(--zameen-700)]">{msg}</span>}
      </div>
    </form>
  );
}
