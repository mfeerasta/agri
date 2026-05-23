'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@zameen/ui';
import { REPORT_DATA_SOURCES } from '@zameen/shared';
import type {
  ReportDataSource,
  ReportFilter,
  ReportAggregation,
} from '@zameen/shared';
import { saveCustomReport } from './actions';

type ChartKind = 'table' | 'bar' | 'line' | 'pie' | 'area' | 'kpi_cards';
const CHART_OPTIONS: ChartKind[] = ['table', 'bar', 'line', 'pie', 'area', 'kpi_cards'];

export function ReportWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState('');
  const [sourceId, setSourceId] = React.useState<string>('');
  const [filters, setFilters] = React.useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = React.useState<string[]>([]);
  const [aggs, setAggs] = React.useState<ReportAggregation[]>([]);
  const [chartKind, setChartKind] = React.useState<ChartKind>('table');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const source = React.useMemo<ReportDataSource | undefined>(
    () => REPORT_DATA_SOURCES.find((s) => s.id === sourceId),
    [sourceId],
  );

  function addFilter() {
    const c = source?.columns.find((col) => col.filterable);
    if (!c) return;
    setFilters((f) => [...f, { column: c.name, op: 'eq', value: '' }]);
  }
  function addAgg() {
    const c = source?.columns.find((col) => col.aggregatable);
    if (!c) return;
    setAggs((a) => [...a, { column: c.name, fn: 'sum' }]);
  }
  function toggleGroup(col: string) {
    setGroupBy((g) => (g.includes(col) ? g.filter((x) => x !== col) : [...g, col]));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await saveCustomReport({
      name,
      dataSource: sourceId,
      filters,
      groupBy: groupBy.length ? groupBy : undefined,
      aggregations: aggs,
      chartKind,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    router.push(`/reports/${res.id}` as never);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Step {step} of 5</CardTitle></CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-3">
              <label className="block text-xs smallcaps">Report name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
              />
              <label className="block text-xs smallcaps">Data source</label>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                {REPORT_DATA_SOURCES.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSourceId(s.id)}
                    className={`text-left rounded border p-2 text-xs ${sourceId === s.id ? 'border-[var(--accent)] bg-[var(--surface-2)]' : 'border-[var(--border)]'}`}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[var(--fg-muted)]">{s.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 && source ? (
            <div className="space-y-2">
              <div className="text-xs smallcaps">Filter chips</div>
              {filters.map((f, i) => (
                <div key={i} className="flex gap-1 text-xs">
                  <select
                    value={f.column}
                    onChange={(e) => {
                      const next = [...filters];
                      next[i] = { ...next[i], column: e.target.value };
                      setFilters(next);
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-1"
                  >
                    {source.columns.filter((c) => c.filterable).map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    value={f.op}
                    onChange={(e) => {
                      const next = [...filters];
                      next[i] = { ...next[i], op: e.target.value as ReportFilter['op'] };
                      setFilters(next);
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-1"
                  >
                    {['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like'].map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    value={String(f.value ?? '')}
                    onChange={(e) => {
                      const next = [...filters];
                      next[i] = { ...next[i], value: e.target.value };
                      setFilters(next);
                    }}
                    className="flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-1"
                  />
                  <button
                    type="button"
                    onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                    className="text-[var(--fg-subtle)]"
                  >x</button>
                </div>
              ))}
              <Button type="button" onClick={addFilter} variant="ghost">+ filter</Button>
            </div>
          ) : null}

          {step === 3 && source ? (
            <div className="space-y-2">
              <div className="text-xs smallcaps">Group by</div>
              <div className="flex flex-wrap gap-1">
                {source.columns.filter((c) => c.groupable).map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    onClick={() => toggleGroup(c.name)}
                    className={`px-2 py-1 rounded-full text-xs border ${groupBy.includes(c.name) ? 'border-[var(--accent)] bg-[var(--surface-2)]' : 'border-[var(--border)]'}`}
                  >{c.name}</button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 && source ? (
            <div className="space-y-2">
              <div className="text-xs smallcaps">Aggregations</div>
              {aggs.map((a, i) => (
                <div key={i} className="flex gap-1 text-xs">
                  <select
                    value={a.fn}
                    onChange={(e) => {
                      const next = [...aggs];
                      next[i] = { ...next[i], fn: e.target.value as ReportAggregation['fn'] };
                      setAggs(next);
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-1"
                  >
                    {['sum', 'avg', 'count', 'min', 'max'].map((fn) => (
                      <option key={fn} value={fn}>{fn}</option>
                    ))}
                  </select>
                  <select
                    value={a.column}
                    onChange={(e) => {
                      const next = [...aggs];
                      next[i] = { ...next[i], column: e.target.value };
                      setAggs(next);
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-1"
                  >
                    {source.columns.filter((c) => c.aggregatable).map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAggs(aggs.filter((_, j) => j !== i))}
                    className="text-[var(--fg-subtle)]"
                  >x</button>
                </div>
              ))}
              <Button type="button" onClick={addAgg} variant="ghost">+ aggregation</Button>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-2">
              <div className="text-xs smallcaps">Chart kind</div>
              <div className="flex flex-wrap gap-1">
                {CHART_OPTIONS.map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setChartKind(k)}
                    className={`px-2 py-1 rounded-full text-xs border ${chartKind === k ? 'border-[var(--accent)] bg-[var(--surface-2)]' : 'border-[var(--border)]'}`}
                  >{k}</button>
                ))}
              </div>
              <div className="text-xs text-[var(--fg-muted)]">
                Preview: {aggs.length} aggregation{aggs.length === 1 ? '' : 's'} over {groupBy.length} group{groupBy.length === 1 ? '' : 's'}.
              </div>
            </div>
          ) : null}

          {err ? <div className="text-xs text-[var(--danger)] mt-2">{err}</div> : null}

          <div className="flex justify-between mt-4">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>Back</Button>
            {step < 5 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={step === 1 && (!name || !sourceId)}>Next</Button>
            ) : (
              <Button type="button" onClick={save} disabled={busy || !name || !sourceId || aggs.length === 0}>
                {busy ? 'Saving...' : 'Save report'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
