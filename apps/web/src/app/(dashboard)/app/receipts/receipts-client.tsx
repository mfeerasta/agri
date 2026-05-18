'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReceiptKind, ReceiptResult } from '@/modules/receipts/actions';

const KIND_LABELS: Record<ReceiptKind, string> = {
  document: 'Document',
  diesel: 'Diesel',
  input: 'Input',
  repair: 'Repair',
};

export interface ReceiptsClientProps {
  initial: {
    query: string;
    kinds: ReceiptKind[];
    vendor: string;
    dateFrom: string;
    dateTo: string;
    amountMin: number | null;
    amountMax: number | null;
  };
  rows: ReceiptResult[];
  total: number;
  offset: number;
}

export function ReceiptsClient({ initial, rows, total, offset }: ReceiptsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initial.query);
  const [kinds, setKinds] = React.useState<ReceiptKind[]>(initial.kinds);
  const [vendor, setVendor] = React.useState(initial.vendor);
  const [dateFrom, setDateFrom] = React.useState(initial.dateFrom);
  const [dateTo, setDateTo] = React.useState(initial.dateTo);
  const [amountMin, setAmountMin] = React.useState<string>(initial.amountMin?.toString() ?? '');
  const [amountMax, setAmountMax] = React.useState<string>(initial.amountMax?.toString() ?? '');

  function toggleKind(k: ReceiptKind) {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function applyFilters(nextOffset = 0) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (kinds.length > 0) params.set('kinds', kinds.join(','));
    if (vendor) params.set('vendor', vendor);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (amountMin) params.set('min', amountMin);
    if (amountMax) params.set('max', amountMax);
    if (nextOffset > 0) params.set('offset', String(nextOffset));
    router.push(`/receipts?${params.toString()}`);
  }

  const hasMore = offset + rows.length < total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block smallcaps text-[0.65rem] mb-1">Search</label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilters(0);
            }}
            placeholder="Vendor, amount, or any keyword"
            className="w-full border border-[var(--ink)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block smallcaps text-[0.65rem] mb-1">Vendor</label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="border border-[var(--ink)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block smallcaps text-[0.65rem] mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-[var(--ink)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block smallcaps text-[0.65rem] mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-[var(--ink)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block smallcaps text-[0.65rem] mb-1">Min Rs</label>
          <input
            type="number"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            className="border border-[var(--ink)] px-2 py-1 text-sm w-28"
          />
        </div>
        <div>
          <label className="block smallcaps text-[0.65rem] mb-1">Max Rs</label>
          <input
            type="number"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            className="border border-[var(--ink)] px-2 py-1 text-sm w-28"
          />
        </div>
        <button
          type="button"
          onClick={() => applyFilters(0)}
          className="border border-[var(--ink)] px-4 py-1.5 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
        >
          Apply
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(KIND_LABELS) as ReceiptKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => toggleKind(k)}
            className={
              'border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem] ' +
              (kinds.includes(k) ? 'bg-[var(--ink)] text-[var(--paper)]' : '')
            }
          >
            {KIND_LABELS[k]}
          </button>
        ))}
        {(kinds.length > 0 || query || vendor || dateFrom || dateTo || amountMin || amountMax) && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setKinds([]);
              setVendor('');
              setDateFrom('');
              setDateTo('');
              setAmountMin('');
              setAmountMax('');
              router.push('/receipts');
            }}
            className="border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem] text-[var(--ink)]/60"
          >
            Clear
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--ink)]/50 py-8 text-center">No receipts found.</p>
      ) : (
        <ul className="divide-y divide-[var(--rule)]/40 border border-[var(--rule)]">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="flex items-start gap-3 p-3">
              {r.thumbnailUrl ? (
                <a href={r.thumbnailUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumbnailUrl}
                    alt=""
                    className="h-16 w-16 object-cover border border-[var(--rule)]"
                  />
                </a>
              ) : (
                <div className="h-16 w-16 bg-[var(--paper-2)] border border-[var(--rule)] flex items-center justify-center text-[0.6rem] text-[var(--ink)]/40">
                  no photo
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="smallcaps text-[0.65rem] border border-[var(--ink)] px-1.5 py-0.5">
                    {KIND_LABELS[r.kind]}
                  </span>
                  <Link
                    href={r.sourceLink as never}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {r.title}
                  </Link>
                </div>
                <div className="text-xs text-[var(--ink)]/60 mt-1">
                  {r.vendor ? <span>{r.vendor}</span> : null}
                  {r.dateIso ? <span className="mx-1">·</span> : null}
                  {r.dateIso ? <span>{new Date(r.dateIso).toLocaleDateString()}</span> : null}
                </div>
              </div>
              <div className="text-sm tabular-nums">
                {r.amountPkr != null ? `Rs. ${r.amountPkr.toLocaleString()}` : '—'}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between items-center">
        <div className="text-xs text-[var(--ink)]/50">
          Showing {offset + 1}–{Math.min(offset + rows.length, total)} of {total}
        </div>
        <div className="flex gap-2">
          {offset > 0 && (
            <button
              type="button"
              onClick={() => applyFilters(Math.max(0, offset - 50))}
              className="border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem]"
            >
              Previous
            </button>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={() => applyFilters(offset + 50)}
              className="border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem]"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
