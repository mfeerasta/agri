'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  ViewSwitcher,
  type ViewMode,
  FilterBar,
  KanbanBoard,
  GanttChart,
  CalendarView,
  Card,
  CardContent,
  EmptyState,
  StatusLabel,
} from '@zameen/ui';

export interface SimpleBoardItem {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  meta?: Record<string, string | number | null>;
  href?: string;
}

export interface SimpleBoardProps {
  items: SimpleBoardItem[];
  groups: Array<{ id: string; label: string; color?: string }>;
  available?: ViewMode[];
  groupKey?: string;
  filterEnums?: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>;
  metaColumns?: Array<{ key: string; label: string }>;
  emptyTitle?: string;
}

export function SimpleBoardClient({
  items,
  groups,
  available = ['table', 'kanban', 'gantt', 'calendar'],
  filterEnums = [],
  metaColumns = [],
  emptyTitle = 'Nothing here yet',
}: SimpleBoardProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('kanban');
  const [filters, setFilters] = React.useState<Record<string, unknown>>({});
  const [month, setMonth] = React.useState<Date>(() => new Date());

  const filtered = React.useMemo(() => {
    return items.filter((i) => {
      if (filters.status && i.status !== filters.status) return false;
      for (const f of filterEnums) {
        if (filters[f.key] && i.meta?.[f.key] !== filters[f.key]) return false;
      }
      if (filters.search) {
        const q = (filters.search as string).toLowerCase();
        if (!i.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filters, filterEnums]);

  const filterDefs = [
    {
      key: 'status',
      label: 'Status',
      type: 'enum' as const,
      options: groups.map((g) => ({ value: g.id, label: g.label })),
    },
    ...filterEnums.map((f) => ({ key: f.key, label: f.label, type: 'enum' as const, options: f.options })),
    { key: 'search', label: 'Search', type: 'text' as const },
  ];

  return (
    <div className="space-y-4">
      <ViewSwitcher value={viewMode} onChange={setViewMode} available={available} />
      <FilterBar filters={filterDefs} value={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <EmptyState title={emptyTitle} body="Try adjusting filters." />
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          groups={groups}
          items={filtered}
          getId={(i) => i.id}
          getGroup={(i) => i.status}
          renderCard={(i) => (
            <Link
              href={(i.href ?? '#') as never}
              className="block rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-2.5 hover:border-[var(--accent)]"
            >
              <div className="mb-1 text-xs font-medium text-[var(--fg)]">{i.title}</div>
              {metaColumns.length > 0 ? (
                <div className="flex flex-wrap gap-1 text-[0.65rem] text-[var(--fg-muted)]">
                  {metaColumns.slice(0, 3).map((m) => (
                    <span key={m.key}>
                      <span className="text-[var(--fg-subtle)]">{m.label}: </span>
                      {String(i.meta?.[m.key] ?? '—')}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          )}
        />
      ) : viewMode === 'gantt' ? (
        <GanttChart
          items={filtered
            .filter((i) => i.startDate && i.endDate)
            .map((i) => ({
              id: i.id,
              title: i.title,
              startDate: i.startDate as Date,
              endDate: i.endDate as Date,
              status: i.status,
            }))}
        />
      ) : viewMode === 'calendar' ? (
        <CalendarView
          items={filtered
            .filter((i) => i.startDate)
            .map((i) => ({ id: i.id, title: i.title, date: i.startDate as Date, status: i.status }))}
          month={month}
          onMonthChange={setMonth}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)]/40 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left smallcaps">Title</th>
                  <th className="px-3 py-2 text-left smallcaps">Status</th>
                  {metaColumns.map((m) => (
                    <th key={m.key} className="px-3 py-2 text-left smallcaps">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]/40">
                    <td className="px-3 py-2">
                      {i.href ? (
                        <Link href={i.href as never} className="hover:text-[var(--accent)]">{i.title}</Link>
                      ) : (
                        i.title
                      )}
                    </td>
                    <td className="px-3 py-2"><StatusLabel status={i.status} /></td>
                    {metaColumns.map((m) => (
                      <td key={m.key} className="px-3 py-2 text-xs">{String(i.meta?.[m.key] ?? '—')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
