'use client';
import * as React from 'react';
import { Bookmark, Save, Trash2 } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface SavedView {
  id: string;
  name: string;
  viewMode: string;
  config: Record<string, unknown>;
}

export interface SavedViewsDropdownProps {
  scope: string;
  views: SavedView[];
  currentConfig: Record<string, unknown>;
  currentViewMode: string;
  onApply: (view: SavedView) => void;
  onSave: (name: string, viewMode: string, config: Record<string, unknown>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  className?: string;
}

export function SavedViewsDropdown({
  scope,
  views,
  currentConfig,
  currentViewMode,
  onApply,
  onSave,
  onDelete,
  className,
}: SavedViewsDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSave(trimmed, currentViewMode, currentConfig);
    setName('');
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn('relative', className)} data-scope={scope}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--fg)] hover:bg-[var(--surface-2)]"
      >
        <Bookmark size={12} /> Views
        {views.length > 0 ? <span className="tabular text-[var(--fg-muted)]">({views.length})</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="border-b border-[var(--border)] p-2 max-h-64 overflow-y-auto">
            {views.length === 0 ? (
              <div className="px-2 py-3 text-xs text-[var(--fg-subtle)]">No saved views.</div>
            ) : (
              <ul>
                {views.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-[var(--surface-2)]">
                    <button type="button" onClick={() => { onApply(v); setOpen(false); }} className="flex-1 truncate text-left text-xs">
                      <span>{v.name}</span>
                      <span className="ml-1.5 smallcaps text-[0.6rem] text-[var(--fg-subtle)]">{v.viewMode}</span>
                    </button>
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(v.id)}
                        className="text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                        aria-label="Delete view"
                      >
                        <Trash2 size={12} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-1 p-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this view"
              className="h-7 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-subtle)]"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="inline-flex h-7 items-center gap-1 rounded bg-[var(--accent)] px-2 text-xs font-medium text-[var(--bg)] disabled:opacity-50"
            >
              <Save size={11} /> Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
