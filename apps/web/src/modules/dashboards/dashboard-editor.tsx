'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { WIDGET_KINDS, DashboardGrid } from '@zameen/ui';
import type { WidgetConfig, WidgetKind } from '@zameen/ui';
import { saveDashboard } from './actions';

const DEFAULT_TITLES: Record<WidgetKind, string> = {
  stat: 'Stat',
  line_chart: 'Trend',
  bar_chart: 'Breakdown',
  pie_chart: 'Share',
  task_count: 'Tasks',
  recent_activity: 'Recent activity',
  field_map_mini: 'Fields',
  approval_queue_preview: 'Pending approvals',
  cash_position: 'Cash position',
};

const DEFAULT_SIZE: Record<WidgetKind, { w: number; h: number }> = {
  stat: { w: 3, h: 2 },
  line_chart: { w: 6, h: 3 },
  bar_chart: { w: 6, h: 3 },
  pie_chart: { w: 4, h: 3 },
  task_count: { w: 3, h: 2 },
  recent_activity: { w: 6, h: 4 },
  field_map_mini: { w: 6, h: 4 },
  approval_queue_preview: { w: 6, h: 3 },
  cash_position: { w: 3, h: 2 },
};

export interface DashboardEditorProps {
  id?: string;
  initialName: string;
  initialWidgets: WidgetConfig[];
}

export function DashboardEditor({ id, initialName, initialWidgets }: DashboardEditorProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initialName);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialWidgets);
  const [error, setError] = useState<string | null>(null);

  const addWidget = (kind: WidgetKind) => {
    const size = DEFAULT_SIZE[kind];
    const y = widgets.reduce((m, w) => Math.max(m, w.gridPos.y + w.gridPos.h), 0);
    setWidgets([
      ...widgets,
      { kind, title: DEFAULT_TITLES[kind], config: {}, gridPos: { x: 0, y, w: size.w, h: size.h } },
    ]);
  };

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/widget-idx', String(idx));
  };

  const onDropAt = (targetIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIdx = Number(e.dataTransfer.getData('text/widget-idx'));
    if (Number.isNaN(fromIdx) || fromIdx === targetIdx) return;
    const next = [...widgets];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(targetIdx, 0, moved!);
    // Repack y in order.
    let y = 0;
    for (const w of next) {
      w.gridPos = { ...w.gridPos, x: 0, y };
      y += w.gridPos.h;
    }
    setWidgets(next);
  };

  const removeAt = (idx: number) => setWidgets(widgets.filter((_, i) => i !== idx));

  const resize = (idx: number, delta: { w?: number; h?: number }) => {
    const next = [...widgets];
    const w = next[idx]!;
    next[idx] = {
      ...w,
      gridPos: {
        ...w.gridPos,
        w: Math.max(1, Math.min(12, w.gridPos.w + (delta.w ?? 0))),
        h: Math.max(1, Math.min(12, w.gridPos.h + (delta.h ?? 0))),
      },
    };
    setWidgets(next);
  };

  const save = () => {
    setError(null);
    start(async () => {
      const res = await saveDashboard({ id, name, widgets, isDefault: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/dashboards');
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--rule)] text-sm"
        />
        <button
          onClick={save}
          disabled={pending}
          className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Save as default'}
        </button>
      </div>

      <div>
        <div className="smallcaps text-[0.65rem] mb-2">Add widget</div>
        <div className="flex flex-wrap gap-2">
          {WIDGET_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => addWidget(k)}
              className="text-xs px-3 py-1 rounded border border-[var(--rule)] hover:border-[var(--accent)]"
            >
              + {k.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <DashboardGrid
        widgets={widgets}
        renderWidget={(w, idx) => (
          <div
            draggable
            onDragStart={onDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropAt(idx)}
            className="h-full rounded-[14px] bg-[var(--surface)] border border-[var(--border)] p-3 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <input
                value={w.title}
                onChange={(e) => {
                  const next = [...widgets];
                  next[idx] = { ...w, title: e.target.value };
                  setWidgets(next);
                }}
                className="bg-transparent text-sm font-medium outline-none flex-1"
              />
              <button onClick={() => removeAt(idx)} className="text-xs text-[var(--danger)] ml-2">
                ×
              </button>
            </div>
            <div className="text-xs text-[var(--fg-muted)]">{w.kind}</div>
            <div className="mt-auto flex items-center gap-1 text-xs">
              <button onClick={() => resize(idx, { w: -1 })} className="px-1">−w</button>
              <button onClick={() => resize(idx, { w: 1 })} className="px-1">+w</button>
              <button onClick={() => resize(idx, { h: -1 })} className="px-1">−h</button>
              <button onClick={() => resize(idx, { h: 1 })} className="px-1">+h</button>
              <span className="ml-auto smallcaps text-[0.55rem]">
                {w.gridPos.w}×{w.gridPos.h}
              </span>
            </div>
          </div>
        )}
      />

      {error ? <div className="text-xs text-[var(--danger)]">{error}</div> : null}
    </div>
  );
}
