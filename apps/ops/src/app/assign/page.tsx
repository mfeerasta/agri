import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db, tasks, workers, taskAssignments, fields } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { AssignBoard } from './assign-board';

export const dynamic = 'force-dynamic';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AssignPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const t = new Date();
  const tom = new Date(t);
  tom.setUTCDate(tom.getUTCDate() + 1);
  const tStr = isoDay(t);
  const tomStr = isoDay(tom);

  const unassigned = entityId
    ? await db
        .select({
          id: tasks.id,
          title: tasks.title,
          taskKind: tasks.taskKind,
          fieldId: tasks.fieldId,
          scheduledFor: tasks.scheduledFor,
          estimatedHours: tasks.estimatedHours,
          status: tasks.status,
          assignedCount: sql<number>`(select count(*)::int from zameen.task_assignments where task_id = ${tasks.id})`,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.entityId, entityId),
            inArray(tasks.scheduledFor, [tStr, tomStr]),
            inArray(tasks.status, ['open', 'in_progress'] as never),
          ),
        )
    : [];

  const open = unassigned.filter((u) => u.assignedCount === 0);

  const workerRows = entityId
    ? await db
        .select()
        .from(workers)
        .where(and(eq(workers.entityId, entityId), eq(workers.isActive, true)))
    : [];

  const grouped = workerRows.reduce<Record<string, typeof workerRows>>((acc, w) => {
    (acc[w.workerType] ??= []).push(w);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Masthead section="Task Assignment" />
      {open.length === 0 ? (
        <EmptyState title="Nothing to assign right now" body="Tasks scheduled for today or tomorrow that need workers will show here." />
      ) : (
        <AssignBoard
          tasks={open.map((o) => ({
            id: o.id,
            title: o.title,
            taskKind: o.taskKind,
            scheduledFor: o.scheduledFor,
            estimatedHours: o.estimatedHours ? Number(o.estimatedHours) : null,
          }))}
          workersByType={Object.entries(grouped).map(([type, ws]) => ({
            type,
            workers: ws.map((w) => ({ id: w.id, code: w.code, fullName: w.fullName })),
          }))}
        />
      )}
    </div>
  );
}
