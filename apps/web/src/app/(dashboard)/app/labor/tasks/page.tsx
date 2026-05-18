import { and, desc, eq, gte, inArray, or } from 'drizzle-orm';
import {
  db,
  tasks,
  taskAssignments,
  taskDependencies,
  taskTimeEntries,
  workers,
  entityComments,
  entityActivity,
} from '@zameen/db';
import { computeCriticalPath } from '@zameen/shared';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listSavedViews } from '@/modules/tasks/actions';
import { TaskBoardClient, type BoardTask, type SavedViewRow } from './task-board-client';
import { CalendarDownload } from '@/components/calendar-download';

export const dynamic = 'force-dynamic';

const SCOPE = 'tasks';

export default async function LaborTasksBoardPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return (
      <div>
        <Masthead section="TASKS" />
        <SectionDivider />
        <div className="p-6 text-sm text-[var(--fg-muted)]">Sign in to view tasks.</div>
      </div>
    );
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.entityId, ctx.entityId),
        or(
          inArray(tasks.status, ['open', 'in_progress', 'blocked'] as never),
          gte(tasks.createdAt, new Date(thirtyDaysAgo)),
        ),
      ),
    )
    .orderBy(desc(tasks.createdAt));

  const taskIds = rows.map((r) => r.id);

  const [assignments, depEdges, timeEntries, allWorkers, comments, activity] = await Promise.all([
    taskIds.length > 0
      ? db
          .select({
            taskId: taskAssignments.taskId,
            workerId: taskAssignments.workerId,
            workerName: workers.fullName,
          })
          .from(taskAssignments)
          .leftJoin(workers, eq(workers.id, taskAssignments.workerId))
          .where(inArray(taskAssignments.taskId, taskIds))
      : Promise.resolve([] as Array<{ taskId: string; workerId: string; workerName: string | null }>),
    taskIds.length > 0
      ? db
          .select()
          .from(taskDependencies)
          .where(
            or(
              inArray(taskDependencies.blockedTaskId, taskIds),
              inArray(taskDependencies.blockerTaskId, taskIds),
            ),
          )
      : Promise.resolve([] as Array<{ id: string; blockerTaskId: string; blockedTaskId: string; kind: string }>),
    taskIds.length > 0
      ? db
          .select({
            id: taskTimeEntries.id,
            taskId: taskTimeEntries.taskId,
            startedAt: taskTimeEntries.startedAt,
            endedAt: taskTimeEntries.endedAt,
            durationMinutes: taskTimeEntries.durationMinutes,
            workerName: workers.fullName,
          })
          .from(taskTimeEntries)
          .leftJoin(workers, eq(workers.id, taskTimeEntries.workerId))
          .where(inArray(taskTimeEntries.taskId, taskIds))
      : Promise.resolve(
          [] as Array<{
            id: string;
            taskId: string;
            startedAt: Date | string;
            endedAt: Date | string | null;
            durationMinutes: number | null;
            workerName: string | null;
          }>,
        ),
    db
      .select({ id: workers.id, name: workers.fullName })
      .from(workers)
      .where(and(eq(workers.entityId, ctx.entityId), eq(workers.isActive, true))),
    taskIds.length > 0
      ? db
          .select()
          .from(entityComments)
          .where(and(eq(entityComments.entityKind, 'task'), inArray(entityComments.entityId, taskIds)))
          .orderBy(desc(entityComments.createdAt))
      : Promise.resolve([] as Array<Record<string, unknown>>),
    taskIds.length > 0
      ? db
          .select()
          .from(entityActivity)
          .where(and(eq(entityActivity.entityKind, 'task'), inArray(entityActivity.entityId, taskIds)))
          .orderBy(desc(entityActivity.occurredAt))
          .limit(500)
      : Promise.resolve([] as Array<Record<string, unknown>>),
  ]);

  const titleById = new Map(rows.map((r) => [r.id, r.title]));
  const assignByTask = new Map<string, Array<{ id: string; name: string }>>();
  for (const a of assignments) {
    const list = assignByTask.get(a.taskId) ?? [];
    list.push({ id: a.workerId, name: a.workerName ?? '—' });
    assignByTask.set(a.taskId, list);
  }
  const predBy = new Map<string, Array<{ id: string; title: string }>>();
  const succBy = new Map<string, Array<{ id: string; title: string }>>();
  const depsBy = new Map<string, string[]>();
  for (const d of depEdges) {
    const blocked = d.blockedTaskId as string;
    const blocker = d.blockerTaskId as string;
    const arr = predBy.get(blocked) ?? [];
    arr.push({ id: blocker, title: titleById.get(blocker) ?? '—' });
    predBy.set(blocked, arr);
    const arr2 = succBy.get(blocker) ?? [];
    arr2.push({ id: blocked, title: titleById.get(blocked) ?? '—' });
    succBy.set(blocker, arr2);
    const dl = depsBy.get(blocked) ?? [];
    dl.push(blocker);
    depsBy.set(blocked, dl);
  }

  const timeBy = new Map<string, BoardTask['timeEntries']>();
  for (const te of timeEntries) {
    const list = timeBy.get(te.taskId) ?? [];
    list.push({
      id: te.id,
      startedAt: te.startedAt instanceof Date ? te.startedAt.toISOString() : String(te.startedAt),
      endedAt: te.endedAt ? (te.endedAt instanceof Date ? te.endedAt.toISOString() : String(te.endedAt)) : null,
      durationMinutes: te.durationMinutes,
      workerName: te.workerName ?? undefined,
    });
    timeBy.set(te.taskId, list);
  }

  const commentsBy = new Map<string, BoardTask['comments']>();
  for (const c of comments) {
    const id = (c as { entityId: string }).entityId;
    const list = commentsBy.get(id) ?? [];
    list.push({
      id: (c as { id: string }).id,
      body: (c as { body: string }).body,
      authorName: 'User',
      createdAt: new Date((c as { createdAt: string | Date }).createdAt).toISOString(),
      parentCommentId: (c as { parentCommentId: string | null }).parentCommentId,
    });
    commentsBy.set(id, list);
  }

  const activityBy = new Map<string, BoardTask['activity']>();
  for (const a of activity) {
    const id = (a as { entityId: string }).entityId;
    const list = activityBy.get(id) ?? [];
    list.push({
      id: (a as { id: string }).id,
      verb: (a as { verb: string }).verb,
      occurredAt: new Date((a as { occurredAt: string | Date }).occurredAt).toISOString(),
    });
    activityBy.set(id, list);
  }

  const subtasksBy = new Map<string, BoardTask['subtasks']>();
  for (const r of rows) {
    if (!r.parentTaskId) continue;
    const list = subtasksBy.get(r.parentTaskId) ?? [];
    list.push({ id: r.id, title: r.title, status: r.status });
    subtasksBy.set(r.parentTaskId, list);
  }

  const cpResult = computeCriticalPath(
    rows.map((r) => ({
      id: r.id,
      durationDays: Math.max(1, Math.round(Number(r.estimatedHours ?? 8) / 8)),
      dependencies: depsBy.get(r.id) ?? [],
    })),
  );
  const criticalSet = new Set(cpResult.criticalIds);

  const boardTasks: BoardTask[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority ?? 'medium',
    labels: (r.labels as string[]) ?? [],
    dueDate: r.dueDate,
    scheduledFor: r.scheduledFor,
    estimatedHours: r.estimatedHours != null ? Number(r.estimatedHours) : null,
    parentTaskId: r.parentTaskId,
    critical: criticalSet.has(r.id),
    assignees: assignByTask.get(r.id) ?? [],
    dependencies: depsBy.get(r.id) ?? [],
    subtasks: subtasksBy.get(r.id) ?? [],
    predecessors: predBy.get(r.id) ?? [],
    successors: succBy.get(r.id) ?? [],
    timeEntries: timeBy.get(r.id) ?? [],
    comments: commentsBy.get(r.id) ?? [],
    activity: activityBy.get(r.id) ?? [],
    attachments: (r.attachments as Array<{ url: string; name?: string }>) ?? [],
  }));

  const savedRaw = await listSavedViews(SCOPE);
  const savedViewRows: SavedViewRow[] = savedRaw.map((v) => ({
    id: v.id as string,
    name: v.name as string,
    viewMode: v.viewMode as string,
    config: (v.config as Record<string, unknown>) ?? {},
    shared: Boolean(v.shared),
  }));

  const [currentWorker] = await db
    .select({ id: workers.id })
    .from(workers)
    .where(eq(workers.userId, ctx.userId))
    .limit(1);

  return (
    <div>
      <Masthead section="TASKS" />
      <SectionDivider label={`${boardTasks.length} tasks`} />
      <div className="flex justify-end px-4 pt-3">
        <CalendarDownload scope="tasks" />
      </div>
      <div className="p-4">
        <TaskBoardClient
          scope={SCOPE}
          tasks={boardTasks}
          savedViews={savedViewRows}
          workers={allWorkers}
          currentWorkerId={currentWorker?.id ?? null}
        />
      </div>
    </div>
  );
}
