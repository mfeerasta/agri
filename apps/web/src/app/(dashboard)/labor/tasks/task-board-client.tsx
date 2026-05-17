'use client';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ViewSwitcher,
  type ViewMode,
  FilterBar,
  SavedViewsDropdown,
  KanbanBoard,
  GanttChart,
  CalendarView,
  WorkloadView,
  TaskDrawer,
  StatusLabel,
  PriorityBadge,
  PersonStack,
  Card,
  CardContent,
  EmptyState,
} from '@zameen/ui';
import {
  updateTask,
  addComment,
  startTimer,
  stopTimer,
  saveView,
} from '@/modules/tasks/actions';

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  labels: string[];
  dueDate: string | null;
  scheduledFor: string | null;
  estimatedHours: number | null;
  parentTaskId: string | null;
  critical: boolean;
  assignees: Array<{ id: string; name: string }>;
  dependencies: string[];
  subtasks: Array<{ id: string; title: string; status: string }>;
  predecessors: Array<{ id: string; title: string }>;
  successors: Array<{ id: string; title: string }>;
  timeEntries: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number | null;
    workerName?: string;
  }>;
  comments: Array<{
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
    parentCommentId: string | null;
  }>;
  activity: Array<{ id: string; verb: string; actorName?: string; occurredAt: string }>;
  attachments: Array<{ url: string; name?: string }>;
}

export interface SavedViewRow {
  id: string;
  name: string;
  viewMode: string;
  config: Record<string, unknown>;
  shared: boolean;
}

interface Props {
  scope: string;
  tasks: BoardTask[];
  savedViews: SavedViewRow[];
  workers: Array<{ id: string; name: string }>;
  currentWorkerId: string | null;
}

const STATUS_GROUPS = [
  { id: 'open', label: 'Open', color: '#94a3b8' },
  { id: 'in_progress', label: 'In Progress', color: '#38bdf8' },
  { id: 'blocked', label: 'Blocked', color: '#fbbf24' },
  { id: 'done', label: 'Done', color: '#34d399' },
  { id: 'cancelled', label: 'Cancelled', color: '#f87171' },
];

const PRIORITY_GROUPS = [
  { id: 'urgent', label: 'Urgent', color: '#f87171' },
  { id: 'high', label: 'High', color: '#fbbf24' },
  { id: 'medium', label: 'Medium', color: '#38bdf8' },
  { id: 'low', label: 'Low', color: '#94a3b8' },
];

const FILTER_DEFS = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum' as const,
    options: STATUS_GROUPS.map((s) => ({ value: s.id, label: s.label })),
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum' as const,
    options: PRIORITY_GROUPS.map((p) => ({ value: p.id, label: p.label })),
  },
  { key: 'dueFrom', label: 'Due from', type: 'date' as const },
  { key: 'dueTo', label: 'Due to', type: 'date' as const },
  { key: 'search', label: 'Search', type: 'text' as const },
];

const GROUPABLE = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
];

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - day);
  return out;
}

export function TaskBoardClient({ scope, tasks, savedViews, workers, currentWorkerId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskParam = searchParams?.get('task') ?? null;

  const [viewMode, setViewMode] = React.useState<ViewMode>('table');
  const [filters, setFilters] = React.useState<Record<string, unknown>>({});
  const [groupBy, setGroupBy] = React.useState<string | null>('status');
  const [weekStart, setWeekStart] = React.useState<Date>(() => startOfWeek(new Date()));
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => new Date());
  const [isPending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    return tasks.filter((t) => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.dueFrom && t.dueDate && t.dueDate < (filters.dueFrom as string)) return false;
      if (filters.dueTo && t.dueDate && t.dueDate > (filters.dueTo as string)) return false;
      if (filters.search) {
        const q = (filters.search as string).toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const activeTask = React.useMemo(
    () => (taskParam ? tasks.find((t) => t.id === taskParam) ?? null : null),
    [taskParam, tasks],
  );

  function openTask(id: string): void {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    sp.set('task', id);
    router.replace(`?${sp.toString()}`);
  }

  function closeTask(): void {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    sp.delete('task');
    const q = sp.toString();
    router.replace(q ? `?${q}` : '?');
  }

  function handleKanbanMove(itemId: string, _from: string, to: string): void {
    startTransition(() => {
      void updateTask({ id: itemId, patch: { status: to } }).then(() => router.refresh());
    });
  }

  function handleStatus(id: string, status: string): Promise<void> {
    return updateTask({ id, patch: { status } }).then(() => router.refresh());
  }

  function handleTitle(id: string, title: string): Promise<void> {
    return updateTask({ id, patch: { title } }).then(() => router.refresh());
  }

  function handleDescription(id: string, description: string): Promise<void> {
    return updateTask({ id, patch: { description } }).then(() => router.refresh());
  }

  async function handleAddComment(taskId: string, body: string, parentCommentId?: string): Promise<void> {
    await addComment({ entityKind: 'task', entityId: taskId, body, parentCommentId });
    router.refresh();
  }

  async function handleStartTimer(taskId: string): Promise<void> {
    if (!currentWorkerId) return;
    await startTimer({ taskId, workerId: currentWorkerId });
    router.refresh();
  }

  async function handleStopTimer(entryId: string): Promise<void> {
    await stopTimer({ entryId });
    router.refresh();
  }

  async function handleSaveView(name: string, mode: string, config: Record<string, unknown>): Promise<void> {
    await saveView({ scope, name, viewMode: mode as ViewMode, config });
    router.refresh();
  }

  function applySavedView(v: { viewMode: string; config: Record<string, unknown> }): void {
    setViewMode(v.viewMode as ViewMode);
    if (v.config?.filters) setFilters(v.config.filters as Record<string, unknown>);
    if (typeof v.config?.groupBy === 'string' || v.config?.groupBy === null) {
      setGroupBy(v.config.groupBy as string | null);
    }
  }

  const groups = groupBy === 'priority' ? PRIORITY_GROUPS : STATUS_GROUPS;
  const getGroup = (t: BoardTask): string => {
    if (groupBy === 'priority') return t.priority ?? 'medium';
    return t.status;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitcher value={viewMode} onChange={setViewMode} />
        <div className="flex items-center gap-2">
          <SavedViewsDropdown
            scope={scope}
            views={savedViews.map((v) => ({ id: v.id, name: v.name, viewMode: v.viewMode, config: v.config }))}
            currentConfig={{ filters, groupBy }}
            currentViewMode={viewMode}
            onApply={applySavedView}
            onSave={handleSaveView}
          />
        </div>
      </div>

      <FilterBar
        filters={FILTER_DEFS}
        value={filters}
        onChange={setFilters}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        groupableKeys={GROUPABLE}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No tasks match" body="Adjust filters or create a task." />
      ) : viewMode === 'table' ? (
        <TableView tasks={filtered} onOpen={openTask} />
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          groups={groups}
          items={filtered}
          getId={(t) => t.id}
          getGroup={getGroup}
          onMove={groupBy === 'status' ? handleKanbanMove : undefined}
          renderCard={(t) => (
            <button
              type="button"
              onClick={() => openTask(t.id)}
              className="block w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left hover:border-[var(--accent)]"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-[var(--fg)]">{t.title}</span>
                {t.critical ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {t.priority ? <PriorityBadge priority={t.priority} /> : null}
                {t.dueDate ? (
                  <span className="tabular text-[0.65rem] text-[var(--fg-muted)]">{t.dueDate}</span>
                ) : null}
                {t.labels.slice(0, 2).map((l) => (
                  <span key={l} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.6rem] text-[var(--fg-muted)]">
                    {l}
                  </span>
                ))}
              </div>
              {t.assignees.length > 0 ? (
                <div className="mt-1.5">
                  <PersonStack persons={t.assignees} max={3} />
                </div>
              ) : null}
            </button>
          )}
        />
      ) : viewMode === 'gantt' ? (
        <GanttChart
          items={filtered
            .filter((t) => t.scheduledFor || t.dueDate)
            .map((t) => {
              const start = new Date(t.scheduledFor ?? t.dueDate ?? new Date().toISOString());
              const end = new Date(t.dueDate ?? t.scheduledFor ?? new Date().toISOString());
              return {
                id: t.id,
                title: t.title,
                startDate: start,
                endDate: end > start ? end : new Date(start.getTime() + 86_400_000),
                status: t.status,
                critical: t.critical,
                assignees: t.assignees.map((a) => a.name),
                dependencies: t.dependencies,
              };
            })}
          onClick={openTask}
        />
      ) : viewMode === 'calendar' ? (
        <CalendarView
          items={filtered
            .filter((t) => t.dueDate)
            .map((t) => ({
              id: t.id,
              title: t.title,
              date: new Date(t.dueDate as string),
              status: t.status,
            }))}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onItemClick={openTask}
        />
      ) : viewMode === 'workload' ? (
        <WorkloadView
          items={buildWorkloadItems(filtered)}
          weekStart={weekStart}
          onCellClick={(_w, d) => setWeekStart(startOfWeek(d))}
        />
      ) : (
        <ChartView tasks={filtered} />
      )}

      <TaskDrawer
        task={activeTask}
        open={!!activeTask}
        onClose={closeTask}
        onTitleChange={activeTask ? (t) => handleTitle(activeTask.id, t) : undefined}
        onStatusChange={activeTask ? (s) => handleStatus(activeTask.id, s) : undefined}
        onDescriptionChange={activeTask ? (d) => handleDescription(activeTask.id, d) : undefined}
        onAddComment={
          activeTask ? (body, parent) => handleAddComment(activeTask.id, body, parent) : undefined
        }
        onStartTimer={
          activeTask && currentWorkerId ? () => handleStartTimer(activeTask.id) : undefined
        }
        onStopTimer={(id) => handleStopTimer(id)}
      />

      {isPending ? (
        <div className="fixed bottom-4 right-4 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--fg-muted)]">
          Saving…
        </div>
      ) : null}
    </div>
  );
}

function TableView({ tasks, onOpen }: { tasks: BoardTask[]; onOpen: (id: string) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)]/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left smallcaps">Task</th>
              <th className="px-3 py-2 text-left smallcaps">Status</th>
              <th className="px-3 py-2 text-left smallcaps">Priority</th>
              <th className="px-3 py-2 text-left smallcaps">Assignees</th>
              <th className="px-3 py-2 text-left smallcaps">Due</th>
              <th className="px-3 py-2 text-left smallcaps">Labels</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr
                key={t.id}
                onClick={() => onOpen(t.id)}
                className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2)]/40"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {t.critical ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden /> : null}
                    <span>{t.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2"><StatusLabel status={t.status} /></td>
                <td className="px-3 py-2">{t.priority ? <PriorityBadge priority={t.priority} /> : null}</td>
                <td className="px-3 py-2"><PersonStack persons={t.assignees} /></td>
                <td className="px-3 py-2 tabular text-xs">{t.dueDate ?? '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {t.labels.map((l) => (
                      <span key={l} className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.65rem] text-[var(--fg-muted)]">
                        {l}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ChartView({ tasks }: { tasks: BoardTask[] }) {
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="smallcaps mb-4 text-xs">Tasks by status</h3>
        <div className="space-y-2">
          {STATUS_GROUPS.map((g) => {
            const c = counts[g.id] ?? 0;
            return (
              <div key={g.id} className="flex items-center gap-3">
                <span className="w-24 text-xs text-[var(--fg-muted)]">{g.label}</span>
                <div className="h-5 flex-1 rounded bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(c / max) * 100}%`, background: g.color }}
                  />
                </div>
                <span className="w-10 text-right tabular text-xs">{c}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function buildWorkloadItems(tasks: BoardTask[]): Array<{
  taskId: string;
  taskTitle: string;
  workerId: string;
  workerName: string;
  date: Date;
}> {
  const items: Array<{ taskId: string; taskTitle: string; workerId: string; workerName: string; date: Date }> = [];
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = new Date(t.dueDate);
    for (const a of t.assignees) {
      items.push({ taskId: t.id, taskTitle: t.title, workerId: a.id, workerName: a.name, date: d });
    }
  }
  return items;
}
