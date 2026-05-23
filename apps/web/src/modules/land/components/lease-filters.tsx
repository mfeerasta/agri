'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const TENURES = ['all', 'owned', 'rented_in', 'rented_out', 'sharecrop_in', 'sharecrop_out', 'musharka', 'other'] as const;
const STATUSES = ['all', 'active', 'expired', 'terminated', 'disputed'] as const;

export function LeaseFilters({ currentTenure, currentStatus }: { currentTenure: string; currentStatus: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback(
    (key: 'tenure' | 'status', value: string) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (value === 'all') params.delete(key);
      else params.set(key, value);
      router.push(`/land/leases?${params.toString()}` as never);
    },
    [router, sp],
  );

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={currentTenure}
        onChange={(e) => update('tenure', e.target.value)}
        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
        aria-label="Filter by tenure"
      >
        {TENURES.map((t) => (
          <option key={t} value={t}>
            {t === 'all' ? 'All tenures' : t.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      <select
        value={currentStatus}
        onChange={(e) => update('status', e.target.value)}
        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
        aria-label="Filter by status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === 'all' ? 'All statuses' : s}
          </option>
        ))}
      </select>
    </div>
  );
}
