import * as React from 'react';
import { Table2, Columns3, GanttChart, CalendarDays, Users, BarChart3 } from 'lucide-react';
import { cn } from '../lib/cn.js';

export type ViewMode = 'table' | 'kanban' | 'gantt' | 'calendar' | 'workload' | 'chart';

export interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
  available?: ViewMode[];
  className?: string;
}

const ALL: Array<{ mode: ViewMode; label: string; icon: typeof Table2 }> = [
  { mode: 'table', label: 'Table', icon: Table2 },
  { mode: 'kanban', label: 'Kanban', icon: Columns3 },
  { mode: 'gantt', label: 'Gantt', icon: GanttChart },
  { mode: 'calendar', label: 'Calendar', icon: CalendarDays },
  { mode: 'workload', label: 'Workload', icon: Users },
  { mode: 'chart', label: 'Chart', icon: BarChart3 },
];

export function ViewSwitcher({ value, onChange, available, className }: ViewSwitcherProps) {
  const items = available ? ALL.filter((i) => available.includes(i.mode)) : ALL;
  return (
    <div className={cn('inline-flex items-center gap-1 border border-[var(--border)] rounded-[10px] bg-[var(--surface)] p-1', className)}>
      {items.map(({ mode, label, icon: Icon }) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs transition-colors relative',
              active
                ? 'bg-[var(--surface-2)] text-[var(--fg)]'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]/60',
            )}
            aria-pressed={active}
          >
            <Icon size={14} strokeWidth={1.8} />
            <span>{label}</span>
            {active ? <span className="absolute left-2 right-2 -bottom-[5px] h-[2px] bg-[var(--accent)] rounded-full" /> : null}
          </button>
        );
      })}
    </div>
  );
}
