'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface WorkloadItem {
  taskId: string;
  taskTitle?: string;
  workerId: string;
  workerName: string;
  date: Date;
}

export interface WorkloadViewProps {
  items: WorkloadItem[];
  weekStart: Date;
  onCellClick?: (workerId: string, date: Date) => void;
  className?: string;
}

const DAY_MS = 86_400_000;

function loadColor(count: number): string {
  if (count <= 0) return 'transparent';
  if (count < 3) return 'rgba(127,176,105,0.35)';
  if (count <= 5) return 'rgba(245,180,84,0.40)';
  return 'rgba(248,113,113,0.45)';
}

function sameYmd(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function WorkloadView({ items, weekStart, onCellClick, className }: WorkloadViewProps) {
  const days = Array.from({ length: 7 }).map((_, i) => new Date(weekStart.getTime() + i * DAY_MS));

  const workers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) if (!map.has(it.workerId)) map.set(it.workerId, it.workerName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  function cellItems(workerId: string, d: Date): WorkloadItem[] {
    return items.filter((it) => it.workerId === workerId && sameYmd(it.date, d));
  }

  if (workers.length === 0) {
    return (
      <div className={cn('rounded-[14px] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--fg-muted)]', className)}>
        No worker assignments this week.
      </div>
    );
  }

  return (
    <div className={cn('rounded-[14px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[var(--surface-2)]/40">
            <tr>
              <th className="border-b border-r border-[var(--border)] px-3 py-2 text-left smallcaps text-[0.65rem]">Worker</th>
              {days.map((d, i) => (
                <th key={i} className="border-b border-r border-[var(--border)] px-2 py-2 text-center smallcaps text-[0.65rem]">
                  <div>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                  <div className="tabular text-[var(--fg-muted)]">{d.getDate()}/{d.getMonth() + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id}>
                <td className="border-b border-r border-[var(--border)] px-3 py-2 truncate max-w-[180px]">{w.name}</td>
                {days.map((d, i) => {
                  const list = cellItems(w.id, d);
                  const count = list.length;
                  const tip = list.map((it) => it.taskTitle ?? it.taskId).join('\n') || 'No tasks';
                  return (
                    <td
                      key={i}
                      onClick={() => onCellClick?.(w.id, d)}
                      title={tip}
                      className={cn(
                        'border-b border-r border-[var(--border)] px-2 py-2 text-center tabular cursor-pointer hover:opacity-80',
                      )}
                      style={{ background: loadColor(count) }}
                    >
                      {count > 0 ? count : <span className="text-[var(--fg-subtle)]">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-3 py-2 text-[0.65rem] text-[var(--fg-muted)]">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: loadColor(1) }} /> &lt; 3</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: loadColor(4) }} /> 3-5</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: loadColor(6) }} /> &gt; 5</span>
      </div>
    </div>
  );
}
