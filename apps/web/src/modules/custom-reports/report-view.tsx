'use client';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@zameen/ui';
import type { ReportExecutionResult } from '@zameen/finance';

export interface ReportViewProps {
  reportName: string;
  result: ReportExecutionResult;
}

export function ReportView({ reportName, result }: ReportViewProps) {
  const { rows, columns, chart, summary, durationMs, rowCount } = result;

  function exportCsv() {
    const head = columns.join(',');
    const body = rows.map((r) => columns.map((c) => JSON.stringify(r[c] ?? '')).join(',')).join('\n');
    const blob = new Blob([`${head}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    // simple browser-side print path. real pdf rendering happens server-side
    // via the delivery cron when scheduled.
    window.print();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>{reportName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-[var(--fg-muted)] mb-2">
            <span>{summary}</span>
            <span>{rowCount} rows in {durationMs} ms</span>
          </div>
          <div className="flex gap-2 mb-3">
            <Button type="button" variant="ghost" onClick={exportCsv}>Export XLSX</Button>
            <Button type="button" variant="ghost" onClick={exportPdf}>Export PDF</Button>
          </div>

          {chart.kind && chart.kind !== 'table' ? (
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 mb-3">
              <div className="text-xs smallcaps text-[var(--fg-muted)] mb-2">{chart.kind}</div>
              <div className="space-y-1">
                {chart.labels.map((label, i) => (
                  <div key={label + i} className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate">{label}</span>
                    {chart.series.map((s) => (
                      <span key={s.name} className="flex-1">
                        <span
                          className="inline-block h-2 rounded bg-[var(--accent)]"
                          style={{ width: `${Math.min(100, (s.data[i] / Math.max(1, Math.max(...s.data))) * 100)}%` }}
                        />
                        <span className="ml-1 tabular text-[var(--fg-muted)]">{s.data[i]}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {columns.map((c) => (
                    <th key={c} className="px-2 py-1 text-left smallcaps">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/40">
                    {columns.map((c) => (
                      <td key={c} className="px-2 py-1 tabular">{String(r[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
