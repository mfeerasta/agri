'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface CalendarItem {
  id: string;
  title: string;
  date: Date;
  color?: string;
  status?: string;
}

export interface CalendarViewProps {
  items: CalendarItem[];
  month?: Date;
  onMonthChange?: (m: Date) => void;
  onItemClick?: (id: string) => void;
  onCellDrop?: (itemId: string, newDate: Date) => void;
  className?: string;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameYmd(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView({
  items,
  month,
  onMonthChange,
  onItemClick,
  onCellDrop,
  className,
}: CalendarViewProps) {
  const [internalMonth, setInternalMonth] = React.useState<Date>(month ?? startOfMonth(new Date()));
  const current = month ?? internalMonth;
  const setMonth = (m: Date) => {
    if (onMonthChange) onMonthChange(m);
    else setInternalMonth(m);
  };

  const first = startOfMonth(current);
  const firstDow = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(current.getFullYear(), current.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const itemsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const key = `${it.date.getFullYear()}-${it.date.getMonth()}-${it.date.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [items]);

  function keyFor(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, d: Date) {
    e.preventDefault();
    if (!onCellDrop) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as { itemId: string };
      onCellDrop(data.itemId, d);
    } catch {
      /* ignore */
    }
  }

  const today = new Date();

  return (
    <div className={cn('rounded-[14px] border border-[var(--border)] bg-[var(--surface)]', className)}>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <button
          type="button"
          onClick={() => setMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="font-display text-lg">
          {current.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => setMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center smallcaps text-[0.65rem]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, idx) => {
          if (!c) return <div key={idx} className="min-h-[96px] border-b border-r border-[var(--border)] bg-[var(--surface)]/30" />;
          const list = itemsByDay.get(keyFor(c)) ?? [];
          const isToday = sameYmd(c, today);
          return (
            <div
              key={idx}
              onDragOver={(e) => {
                if (onCellDrop) e.preventDefault();
              }}
              onDrop={(e) => handleDrop(e, c)}
              className={cn(
                'min-h-[96px] border-b border-r border-[var(--border)] p-1.5 text-xs flex flex-col gap-1',
                isToday ? 'bg-[var(--accent)]/5' : '',
              )}
            >
              <div className={cn('tabular text-[0.7rem]', isToday ? 'text-[var(--accent)] font-semibold' : 'text-[var(--fg-muted)]')}>
                {c.getDate()}
              </div>
              {list.slice(0, 3).map((it) => (
                <button
                  key={it.id}
                  type="button"
                  draggable={!!onCellDrop}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: it.id }));
                  }}
                  onClick={() => onItemClick?.(it.id)}
                  className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[0.7rem] hover:opacity-90"
                  style={{ background: it.color ?? 'var(--surface-2)', color: 'var(--fg)' }}
                  title={it.title}
                >
                  {it.title}
                </button>
              ))}
              {list.length > 3 ? (
                <span className="text-[0.65rem] text-[var(--fg-subtle)]">+{list.length - 3} more</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
