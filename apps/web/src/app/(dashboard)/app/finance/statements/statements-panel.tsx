'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';

type PresetKey = 'this-month' | 'last-month' | 'fy' | 'custom';

interface Period { from: string; to: string }

const STATEMENTS = [
  { kind: 'balance-sheet', titleEn: 'Balance Sheet', titleUr: 'گوشوارہ مالیات', usesPeriod: false },
  { kind: 'income-statement', titleEn: 'Income Statement', titleUr: 'نفع و نقصان', usesPeriod: true },
  { kind: 'cash-flow', titleEn: 'Cash Flow Statement', titleUr: 'گوشوارہ نقدی', usesPeriod: true },
  { kind: 'field-pnl', titleEn: 'Field P&L', titleUr: 'کھیت کا نفع نقصان', usesPeriod: false },
] as const;

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

function computePeriod(preset: PresetKey, customFrom: string, customTo: string): Period {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (preset === 'this-month') {
    return { from: isoDate(new Date(Date.UTC(y, m, 1))), to: isoDate(new Date(Date.UTC(y, m + 1, 0))) };
  }
  if (preset === 'last-month') {
    return { from: isoDate(new Date(Date.UTC(y, m - 1, 1))), to: isoDate(new Date(Date.UTC(y, m, 0))) };
  }
  if (preset === 'fy') {
    const fyStartYear = m >= 6 ? y : y - 1;
    return { from: `${fyStartYear}-07-01`, to: `${fyStartYear + 1}-06-30` };
  }
  return { from: customFrom, to: customTo };
}

export function StatementsPanel(): React.JSX.Element {
  const [preset, setPreset] = useState<PresetKey>('this-month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [cropPlanId, setCropPlanId] = useState<string>('');
  const [previewKind, setPreviewKind] = useState<string | null>(null);

  const period = useMemo(() => computePeriod(preset, customFrom, customTo), [preset, customFrom, customTo]);

  function urlFor(kind: string, format: 'pdf' | 'xlsx'): string {
    const qs = new URLSearchParams({ format, from: period.from, to: period.to });
    if (kind === 'field-pnl') {
      if (!cropPlanId) return '';
      qs.set('cropPlanId', cropPlanId);
    }
    return `/api/statements/${kind}?${qs.toString()}`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Period · مدت</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['this-month', 'last-month', 'fy', 'custom'] as PresetKey[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`px-3 py-1 text-sm border rounded ${preset === p ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--ink)]'}`}
              >
                {p === 'this-month' ? 'This month' : p === 'last-month' ? 'Last month' : p === 'fy' ? 'Fiscal year' : 'Custom'}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="flex gap-2 mb-3">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border px-2 py-1 text-sm" />
              <span className="self-center">→</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border px-2 py-1 text-sm" />
            </div>
          ) : null}
          <div className="text-xs text-[var(--ink)]/60">From: {period.from} · To: {period.to}</div>
          <div className="mt-3">
            <label className="block text-xs text-[var(--ink)]/60 mb-1">Field P&amp;L crop plan id (for field-pnl only)</label>
            <input
              type="text"
              value={cropPlanId}
              onChange={(e) => setCropPlanId(e.target.value)}
              placeholder="crop plan uuid"
              className="border px-2 py-1 text-sm w-full max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {STATEMENTS.map((s) => {
          const pdfUrl = urlFor(s.kind, 'pdf');
          const xlsxUrl = urlFor(s.kind, 'xlsx');
          const disabled = s.kind === 'field-pnl' && !cropPlanId;
          return (
            <Card key={s.kind}>
              <CardHeader>
                <CardTitle>{s.titleEn}  ·  {s.titleUr}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60 mb-3">
                  {s.usesPeriod ? `${period.from} → ${period.to}` : s.kind === 'balance-sheet' ? `As of ${period.to}` : 'Crop-plan scoped'}
                </div>
                <div className="flex gap-2">
                  <a
                    href={disabled ? '#' : pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={disabled}
                    className={`px-3 py-1 text-sm border rounded ${disabled ? 'opacity-40 pointer-events-none' : 'bg-[var(--ink)] text-white'}`}
                  >Download PDF</a>
                  <a
                    href={disabled ? '#' : xlsxUrl}
                    aria-disabled={disabled}
                    className={`px-3 py-1 text-sm border rounded ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
                  >Download XLSX</a>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setPreviewKind(previewKind === s.kind ? null : s.kind)}
                    className="px-3 py-1 text-sm border rounded"
                  >{previewKind === s.kind ? 'Hide preview' : 'Preview PDF'}</button>
                </div>
                {previewKind === s.kind && !disabled ? (
                  <div className="mt-3 border">
                    <object data={pdfUrl} type="application/pdf" width="100%" height="600">
                      <p>PDF preview not available. <a href={pdfUrl}>Download</a>.</p>
                    </object>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
