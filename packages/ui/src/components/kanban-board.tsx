'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface KanbanGroup {
  id: string;
  label: string;
  color?: string;
}

export interface KanbanBoardProps<T> {
  groups: KanbanGroup[];
  items: T[];
  getId: (item: T) => string;
  getGroup: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onMove?: (itemId: string, fromGroup: string, toGroup: string) => void;
  className?: string;
}

export function KanbanBoard<T>({
  groups,
  items,
  getId,
  getGroup,
  renderCard,
  onMove,
  className,
}: KanbanBoardProps<T>) {
  const [draggingOver, setDraggingOver] = React.useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map = new Map<string, T[]>();
    for (const g of groups) map.set(g.id, []);
    for (const it of items) {
      const gid = getGroup(it);
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(it);
    }
    return map;
  }, [groups, items, getGroup]);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, itemId: string, fromGroup: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ itemId, fromGroup }));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, toGroup: string) {
    e.preventDefault();
    setDraggingOver(null);
    if (!onMove) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as { itemId: string; fromGroup: string };
      if (data.fromGroup !== toGroup) onMove(data.itemId, data.fromGroup, toGroup);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={cn('flex gap-3 overflow-x-auto pb-2', className)}>
      {groups.map((g) => {
        const list = grouped.get(g.id) ?? [];
        const isOver = draggingOver === g.id;
        return (
          <div
            key={g.id}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-[12px] border bg-[var(--surface)]/40 transition-colors',
              isOver ? 'border-[var(--accent)]' : 'border-[var(--border)]',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDraggingOver(g.id);
            }}
            onDragLeave={() => setDraggingOver((cur) => (cur === g.id ? null : cur))}
            onDrop={(e) => handleDrop(e, g.id)}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: g.color ?? 'var(--accent)' }}
                />
                <span className="smallcaps text-xs">{g.label}</span>
              </span>
              <span className="tabular text-xs text-[var(--fg-muted)]">{list.length}</span>
            </div>
            <div className="flex max-h-[calc(100vh-280px)] flex-1 flex-col gap-2 overflow-y-auto p-2">
              {list.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--fg-subtle)]">
                  Empty
                </div>
              ) : (
                list.map((item) => {
                  const id = getId(item);
                  return (
                    <div
                      key={id}
                      draggable={!!onMove}
                      onDragStart={(e) => handleDragStart(e, id, g.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      {renderCard(item)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
