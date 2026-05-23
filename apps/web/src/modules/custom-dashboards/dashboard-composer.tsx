'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, DashboardGrid } from '@zameen/ui';
import type { WidgetConfig } from '@zameen/ui';
import type { DashboardWidgetLayout } from '@zameen/db';
import { saveCustomDashboard } from './actions';

export interface AvailableReport {
  id: string;
  name: string;
}

export interface DashboardComposerProps {
  reports: AvailableReport[];
  initial?: { id: string; name: string; layout: DashboardWidgetLayout[] };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function DashboardComposer({ reports, initial }: DashboardComposerProps) {
  const router = useRouter();
  const [name, setName] = React.useState(initial?.name ?? '');
  const [layout, setLayout] = React.useState<DashboardWidgetLayout[]>(initial?.layout ?? []);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  function addWidget(reportId: string, title: string) {
    setLayout((l) => [
      ...l,
      { id: uid(), kind: 'report', reportId, title, x: 0, y: l.length * 3, w: 6, h: 3 },
    ]);
  }
  function removeWidget(id: string) {
    setLayout((l) => l.filter((w) => w.id !== id));
  }
  function move(id: string, dx: number, dy: number) {
    setLayout((l) =>
      l.map((w) => (w.id === id ? { ...w, x: Math.max(0, w.x + dx), y: Math.max(0, w.y + dy) } : w)),
    );
  }
  function resize(id: string, dw: number, dh: number) {
    setLayout((l) =>
      l.map((w) =>
        w.id === id
          ? { ...w, w: Math.min(12, Math.max(1, w.w + dw)), h: Math.min(12, Math.max(1, w.h + dh)) }
          : w,
      ),
    );
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await saveCustomDashboard({ id: initial?.id, name, layout });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    router.push(`/dashboards/${res.id}` as never);
  }

  const widgetConfigs: WidgetConfig[] = layout.map((w) => ({
    kind: 'stat',
    title: w.title,
    config: { id: w.id, reportId: w.reportId },
    gridPos: { x: w.x, y: w.y, w: w.w, h: w.h },
  }));

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader><CardTitle>Compose</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <label className="block text-xs smallcaps">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          />
          <div className="text-xs smallcaps mt-3">Add report widget</div>
          <div className="flex flex-wrap gap-1">
            {reports.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => addWidget(r.id, r.name)}
                className="px-2 py-1 rounded-full border border-[var(--border)] text-xs hover:bg-[var(--surface-2)]"
              >+ {r.name}</button>
            ))}
          </div>
          {err ? <div className="text-xs text-[var(--danger)] mt-2">{err}</div> : null}
          <div className="flex gap-2 mt-3">
            <Button type="button" onClick={save} disabled={busy || !name}>
              {busy ? 'Saving...' : 'Save dashboard'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DashboardGrid
        widgets={widgetConfigs}
        renderWidget={(w) => {
          const cfg = w.config as { id: string; reportId?: string };
          return (
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-xs flex items-center justify-between">
                  <span>{w.title}</span>
                  <button type="button" onClick={() => removeWidget(cfg.id)} className="text-[var(--fg-subtle)]">x</button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1 text-xs">
                  <button type="button" onClick={() => move(cfg.id, -1, 0)} className="px-1 border rounded">left</button>
                  <button type="button" onClick={() => move(cfg.id, 1, 0)} className="px-1 border rounded">right</button>
                  <button type="button" onClick={() => move(cfg.id, 0, -1)} className="px-1 border rounded">up</button>
                  <button type="button" onClick={() => move(cfg.id, 0, 1)} className="px-1 border rounded">down</button>
                  <button type="button" onClick={() => resize(cfg.id, 1, 0)} className="px-1 border rounded">w+</button>
                  <button type="button" onClick={() => resize(cfg.id, -1, 0)} className="px-1 border rounded">w-</button>
                  <button type="button" onClick={() => resize(cfg.id, 0, 1)} className="px-1 border rounded">h+</button>
                  <button type="button" onClick={() => resize(cfg.id, 0, -1)} className="px-1 border rounded">h-</button>
                </div>
                <div className="text-xs text-[var(--fg-muted)] mt-2">Linked report: {cfg.reportId}</div>
              </CardContent>
            </Card>
          );
        }}
      />
    </div>
  );
}
