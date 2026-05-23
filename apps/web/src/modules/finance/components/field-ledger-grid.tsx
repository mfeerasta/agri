'use client';
import { Fragment, useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Pkr, Button } from '@zameen/ui';
import type { CostPool } from '@zameen/shared';
import type { FieldLedgerData, LedgerSourceRecord } from '../field-ledger-actions';
import { loadCellSourceRecords } from '../field-ledger-actions';

const POOL_COLORS: Record<string, string> = {
  diesel: '#d97706',
  fertilizer: '#15803d',
  pesticide: '#b91c1c',
  seed: '#1d4ed8',
  labor_field: '#7c3aed',
  labor_livestock: '#6d28d9',
  repairs: '#52525b',
  irrigation: '#0891b2',
  land_rent: '#a16207',
  vet: '#be185d',
  feed: '#65a30d',
  freight: '#ea580c',
  mandi_charges: '#0f766e',
  admin: '#64748b',
  depreciation: '#475569',
  finance_charges: '#7f1d1d',
  tax: '#404040',
};

const POOL_LABEL: Record<string, string> = {
  diesel: 'Diesel',
  fertilizer: 'Fertilizer',
  pesticide: 'Pesticide',
  seed: 'Seed',
  labor_field: 'Field labour',
  labor_livestock: 'Livestock labour',
  repairs: 'Repairs',
  irrigation: 'Irrigation',
  land_rent: 'Land rent',
  vet: 'Vet',
  feed: 'Feed',
  freight: 'Freight',
  mandi_charges: 'Mandi',
  admin: 'Admin',
  depreciation: 'Depreciation',
  finance_charges: 'Finance',
  tax: 'Tax',
};

function poolColor(pool: string): string {
  return POOL_COLORS[pool] ?? '#94a3b8';
}

function StackedBar({ byPool, total }: { byPool: Partial<Record<CostPool, number>>; total: number }) {
  if (total <= 0) return null;
  const entries = Object.entries(byPool).filter(([, v]) => Number(v) > 0);
  return (
    <div className="mt-1 flex h-1 w-full overflow-hidden rounded-sm">
      {entries.map(([pool, v]) => (
        <div
          key={pool}
          title={`${POOL_LABEL[pool] ?? pool}: ${Math.round(Number(v)).toLocaleString()}`}
          style={{ width: `${(Number(v) / total) * 100}%`, background: poolColor(pool) }}
        />
      ))}
    </div>
  );
}

interface CellSelection {
  date: string;
  fieldId: string;
  fieldCode: string;
  pool?: CostPool;
}

export function FieldLedgerGrid({ data, entityId }: { data: FieldLedgerData; entityId: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CellSelection | null>(null);
  const [drill, setDrill] = useState<LedgerSourceRecord[]>([]);
  const [pending, startTransition] = useTransition();

  const activePools = useMemo(
    () =>
      (Object.keys(data.poolTotals) as CostPool[]).sort((a, b) =>
        (data.poolTotals[b] ?? 0) - (data.poolTotals[a] ?? 0),
      ),
    [data.poolTotals],
  );

  function toggle(date: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function openCell(sel: CellSelection) {
    setSelected(sel);
    setDrill([]);
    startTransition(async () => {
      const recs = await loadCellSourceRecords({
        entityId,
        fieldId: sel.fieldId,
        onDate: sel.date,
        pool: sel.pool,
      });
      setDrill(recs);
    });
  }

  if (data.fields.length === 0) {
    return (
      <div className="rounded border border-[var(--rule)] bg-[var(--paper-2)] p-6 text-sm text-[var(--ink)]/60">
        No fields configured for this entity yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded border border-[var(--rule)]">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
            <tr>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem] w-32">Date</th>
              {data.fields.map((f) => (
                <th key={f.id} className="smallcaps text-right px-3 py-2 text-[0.7rem]">
                  {f.code}
                  <div className="text-[0.6rem] font-normal text-[var(--ink)]/50">
                    {f.acres.toFixed(2)} ac
                  </div>
                </th>
              ))}
              <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Day total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={data.fields.length + 2} className="p-6 text-center text-sm text-[var(--ink)]/50">
                  No allocations in this period.
                </td>
              </tr>
            )}
            {data.rows.map((r) => {
              const isOpen = expanded.has(r.date);
              const rowPools = (Object.keys(r.byPool) as CostPool[]).sort((a, b) =>
                (r.byPool[b] ?? 0) - (r.byPool[a] ?? 0),
              );
              return (
                <Fragment key={r.date}>
                  <tr className="border-t border-[var(--rule)] hover:bg-[var(--paper-2)]">
                    <td className="px-3 py-2 tabular text-xs">
                      <button onClick={() => toggle(r.date)} className="text-left">
                        <span className="mr-1 text-[var(--ink)]/40">{isOpen ? '▾' : '▸'}</span>
                        {r.date}
                      </button>
                    </td>
                    {data.fields.map((f) => {
                      const cell = r.perField[f.id];
                      if (!cell || cell.totalPkr === 0) {
                        return <td key={f.id} className="px-3 py-2 text-right text-[var(--ink)]/30">—</td>;
                      }
                      return (
                        <td key={f.id} className="px-3 py-2 text-right">
                          <button
                            onClick={() => openCell({ date: r.date, fieldId: f.id, fieldCode: f.code })}
                            className="block w-full text-right hover:underline"
                          >
                            <Pkr value={cell.totalPkr} />
                            <StackedBar byPool={cell.byPool} total={cell.totalPkr} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular font-medium">
                      <Pkr value={r.totalPkr} />
                    </td>
                  </tr>
                  {isOpen &&
                    rowPools.map((pool) => (
                      <tr key={`${r.date}-${pool}`} className="border-t border-dashed border-[var(--rule)] bg-[var(--paper-2)]/40">
                        <td className="px-3 py-1 pl-8 text-[0.7rem] smallcaps">
                          <span
                            className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                            style={{ background: poolColor(pool) }}
                          />
                          {POOL_LABEL[pool] ?? pool}
                        </td>
                        {data.fields.map((f) => {
                          const v = r.perField[f.id]?.byPool[pool];
                          if (!v) return <td key={f.id} className="px-3 py-1 text-right text-[var(--ink)]/30">—</td>;
                          return (
                            <td key={f.id} className="px-3 py-1 text-right text-xs">
                              <button
                                onClick={() => openCell({ date: r.date, fieldId: f.id, fieldCode: f.code, pool })}
                                className="hover:underline"
                              >
                                <Pkr value={v} />
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-1 text-right text-xs tabular">
                          <Pkr value={r.byPool[pool] ?? 0} />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-[var(--rule)] bg-[var(--paper-2)]">
            <tr>
              <td className="px-3 py-2 smallcaps text-[0.7rem]">Field total</td>
              {data.fields.map((f) => {
                const ft = data.fieldTotals[f.id];
                return (
                  <td key={f.id} className="px-3 py-2 text-right tabular font-medium">
                    <Pkr value={ft?.totalPkr ?? 0} />
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right tabular font-bold">
                <Pkr value={data.grandTotalPkr} mode="lac_crore" />
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1 smallcaps text-[0.65rem] text-[var(--ink)]/60">Per acre</td>
              {data.fields.map((f) => {
                const ft = data.fieldTotals[f.id];
                return (
                  <td key={f.id} className="px-3 py-1 text-right text-xs text-[var(--ink)]/70">
                    {ft && ft.perAcrePkr > 0 ? <Pkr value={ft.perAcrePkr} /> : '—'}
                  </td>
                );
              })}
              <td className="px-3 py-1 text-right text-xs text-[var(--ink)]/60">{data.rows.length} days</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>By cost pool</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {activePools.map((pool) => (
              <div key={pool} className="flex items-center justify-between border-b border-[var(--rule)] py-1 text-sm">
                <span className="flex items-center">
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-sm"
                    style={{ background: poolColor(pool) }}
                  />
                  <span className="smallcaps text-[0.7rem]">{POOL_LABEL[pool] ?? pool}</span>
                </span>
                <Pkr value={data.poolTotals[pool] ?? 0} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded bg-[var(--paper)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-[var(--rule)] pb-2">
              <div>
                <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Drill-down</div>
                <div className="text-sm font-medium">
                  {selected.fieldCode} · {selected.date}
                  {selected.pool ? ` · ${POOL_LABEL[selected.pool] ?? selected.pool}` : ''}
                </div>
              </div>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </div>
            {pending && <div className="p-4 text-center text-sm text-[var(--ink)]/60">Loading…</div>}
            {!pending && drill.length === 0 && (
              <div className="p-4 text-center text-sm text-[var(--ink)]/60">No source records.</div>
            )}
            {!pending && drill.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)]">
                  <tr>
                    <th className="smallcaps text-left px-2 py-1 text-[0.65rem]">Module</th>
                    <th className="smallcaps text-left px-2 py-1 text-[0.65rem]">Pool</th>
                    <th className="smallcaps text-left px-2 py-1 text-[0.65rem]">Source ID</th>
                    <th className="smallcaps text-right px-2 py-1 text-[0.65rem]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drill.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--rule)]">
                      <td className="px-2 py-1 smallcaps text-[0.7rem]">{r.sourceModule}</td>
                      <td className="px-2 py-1 smallcaps text-[0.7rem]">{POOL_LABEL[r.costPool] ?? r.costPool}</td>
                      <td className="px-2 py-1 font-mono text-[0.7rem]">{r.sourceRecordId.slice(0, 8)}</td>
                      <td className="px-2 py-1 text-right"><Pkr value={r.amountPkr} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--rule)] bg-[var(--paper-2)]">
                    <td colSpan={3} className="px-2 py-1 text-right smallcaps text-[0.7rem]">Total</td>
                    <td className="px-2 py-1 text-right font-medium">
                      <Pkr value={drill.reduce((a, r) => a + r.amountPkr, 0)} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
