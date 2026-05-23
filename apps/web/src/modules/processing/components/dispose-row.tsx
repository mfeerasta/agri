'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { disposeByproduct } from '@/modules/processing/actions';

interface Row {
  id: string;
  byproductKind: string;
  quantityKg: string;
  unitValuePkr: string | null;
  createdAt: Date;
}

export function DisposeRow({ row }: { row: Row }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'sold' | 'fed_livestock' | 'composted' | 'given_away' | 'disposed'>('sold');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [proceeds, setProceeds] = useState(0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    start(async () => {
      setErr(null);
      const r = await disposeByproduct({
        byproductId: row.id,
        disposalKind: kind,
        disposedOn: date,
        proceedsPkr: kind === 'sold' ? proceeds : undefined,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <tr className="border-t border-slate-100">
        <td className="px-3 py-2">{row.byproductKind}</td>
        <td className="px-3 py-2">{Number(row.quantityKg).toLocaleString()} kg</td>
        <td className="px-3 py-2">
          {row.unitValuePkr
            ? `PKR ${(Number(row.quantityKg) * Number(row.unitValuePkr)).toLocaleString()}`
            : '-'}
        </td>
        <td className="px-3 py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-emerald-700 hover:underline"
          >
            {open ? 'Cancel' : 'Dispose'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50">
          <td colSpan={5} className="px-3 py-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                Disposal
                <select
                  className="mt-1 block rounded border px-2 py-1"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                >
                  <option value="sold">Sold</option>
                  <option value="fed_livestock">Fed to livestock</option>
                  <option value="composted">Composted</option>
                  <option value="given_away">Given away</option>
                  <option value="disposed">Disposed</option>
                </select>
              </label>
              <label className="text-sm">
                Date
                <input
                  type="date"
                  className="mt-1 block rounded border px-2 py-1"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              {kind === 'sold' && (
                <label className="text-sm">
                  Proceeds PKR
                  <input
                    type="number"
                    className="mt-1 block rounded border px-2 py-1"
                    value={proceeds}
                    onChange={(e) => setProceeds(Number(e.target.value))}
                  />
                </label>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {pending ? 'Saving...' : 'Confirm'}
              </button>
              {err && <span className="text-sm text-rose-600">{err}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
