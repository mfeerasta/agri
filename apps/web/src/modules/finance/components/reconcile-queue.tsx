'use client';
import { useState } from 'react';
import { Pkr } from '@zameen/ui';
import { manualMatchTransaction } from '@/modules/finance/bank-import-actions';

interface QueueRow {
  id: string;
  date: string;
  description: string;
  counterparty: string | null;
  amountPkr: number;
  direction: 'debit' | 'credit';
  status: string;
  accountLabel: string;
}

export function ReconcileQueue({ rows }: { rows: QueueRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function markManual(id: string, kind: 'journal_entry' | 'manual') {
    setBusy(id);
    const res = await manualMatchTransaction({ transactionId: id, kind });
    setBusy(null);
    if (res.ok) {
      const next = new Set(done);
      next.add(id);
      setDone(next);
    }
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
        <tr>
          <th className="p-3">Date</th>
          <th className="p-3">Account</th>
          <th className="p-3">Description</th>
          <th className="p-3">Party</th>
          <th className="p-3 text-right">Amount</th>
          <th className="p-3">Dir</th>
          <th className="p-3">Status</th>
          <th className="p-3">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isDone = done.has(r.id);
          return (
            <tr key={r.id} className={`border-b border-[var(--rule)] ${isDone ? 'opacity-40' : ''}`}>
              <td className="p-3 tabular text-xs">{r.date}</td>
              <td className="p-3 text-xs">{r.accountLabel}</td>
              <td className="p-3 text-xs">{r.description}</td>
              <td className="p-3 text-xs">{r.counterparty ?? '—'}</td>
              <td className="p-3 text-right"><Pkr value={r.amountPkr} /></td>
              <td className="p-3 smallcaps text-[0.7rem]">{r.direction}</td>
              <td className="p-3 smallcaps text-[0.7rem]">{r.status}</td>
              <td className="p-3 text-right">
                <button
                  disabled={busy === r.id || isDone}
                  onClick={() => void markManual(r.id, 'manual')}
                  className="rounded-md border border-[var(--rule)] px-2 py-1 text-xs disabled:opacity-40"
                >
                  {isDone ? 'Reviewed' : 'Mark reviewed'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
