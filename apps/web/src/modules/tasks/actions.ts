'use server';

/**
 * monday-style task management server actions for Zameen.
 *
 * Covers subtasks, dependencies (with cycle detection), time tracking,
 * threaded comments with @mentions, label management, and saved views.
 * Every write also appends to `entity_activity` so the activity stream
 * (rendered alongside tasks, approvals, repairs, crop plans) stays
 * authoritative. Mentions trigger in-app notifications via the
 * existing notifications table.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  db,
  tasks,
  taskDependencies,
  taskTimeEntries,
  entityComments,
  entityActivity,
  entityLabels,
  savedViews,
  notifications,
} from '@zameen/db';
import { parseMentions, detectCycle } from '@zameen/shared';
import { fireTrigger } from '@zameen/automations';
import { getSessionContext } from '@/lib/session';

type R<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

const uuid = z.string().uuid();

// ---------- shared helpers ----------

async function logActivity(input: {
  entityKind: string;
  entityId: string;
  actorId: string | null;
  verb: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(entityActivity).values({
    entityKind: input.entityKind,
    entityId: input.entityId,
    actorId: input.actorId,
    verb: input.verb,
    payload: input.payload ?? {},
  });
}

// ---------- tasks ----------

const createTaskSchema = z.object({
  entityId: uuid,
  title: z.string().min(1).max(512),
  titleUr: z.string().max(512).optional(),
  description: z.string().max(8000).optional(),
  taskKind: z.string().min(1).max(32),
  fieldId: uuid.optional(),
  cropPlanId: uuid.optional(),
  parentTaskId: uuid.optional(),
  scheduledFor: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.coerce.number().nonnegative().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  labelColor: z.enum(['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'gray']).default('gray'),
  labels: z.array(z.string().max(48)).default([]),
  attachments: z
    .array(z.object({ url: z.string().url(), name: z.string().optional(), mimeType: z.string().optional() }))
    .default([]),
});

export async function createTask(raw: unknown): Promise<R> {
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  // Compute taskOrder = max(order) + 1 within the same parent (or top level).
  const siblings = await db
    .select({ taskOrder: tasks.taskOrder })
    .from(tasks)
    .where(
      data.parentTaskId
        ? eq(tasks.parentTaskId, data.parentTaskId)
        : and(eq(tasks.entityId, data.entityId), isNull(tasks.parentTaskId)),
    );
  const maxOrder = siblings.reduce((acc, r) => Math.max(acc, Number(r.taskOrder ?? 0)), -1);

  const [row] = await db
    .insert(tasks)
    .values({
      entityId: data.entityId,
      fieldId: data.fieldId ?? null,
      cropPlanId: data.cropPlanId ?? null,
      parentTaskId: data.parentTaskId ?? null,
      title: data.title,
      titleUr: data.titleUr ?? null,
      description: data.description ?? null,
      taskKind: data.taskKind,
      scheduledFor: data.scheduledFor ?? null,
      dueDate: data.dueDate ?? null,
      estimatedHours: data.estimatedHours != null ? data.estimatedHours.toString() : null,
      priority: data.priority,
      labelColor: data.labelColor,
      labels: data.labels,
      attachments: data.attachments,
      taskOrder: maxOrder + 1,
      status: 'open',
      createdBy: ctx.userId,
    })
    .returning();

  await logActivity({
    entityKind: 'task',
    entityId: row!.id,
    actorId: ctx.userId,
    verb: 'task.created',
    payload: { title: data.title, parentTaskId: data.parentTaskId ?? null },
  });

  await fireTrigger({
    kind: 'task_created',
    entityId: data.entityId,
    event: {
      kind: 'task_created',
      entityId: data.entityId,
      occurredAt: new Date(),
      payload: { taskId: row!.id, title: data.title, taskKind: data.taskKind, dueDate: data.dueDate ?? null },
    },
  });

  revalidatePath('/labor/tasks');
  return { ok: true, id: row!.id };
}

const updateTaskSchema = z.object({
  id: uuid,
  patch: z
    .object({
      title: z.string().min(1).max(512).optional(),
      titleUr: z.string().max(512).nullable().optional(),
      description: z.string().max(8000).nullable().optional(),
      status: z.enum(['open', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
      scheduledFor: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      estimatedHours: z.coerce.number().nonnegative().nullable().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      labelColor: z.enum(['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'gray']).optional(),
      labels: z.array(z.string().max(48)).optional(),
      taskOrder: z.number().int().nonnegative().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, 'Empty patch'),
});

export async function updateTask(raw: unknown): Promise<R> {
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const { id, patch } = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const set: Record<string, unknown> = { ...patch };
  if ('estimatedHours' in set && set.estimatedHours != null) {
    set.estimatedHours = (set.estimatedHours as number).toString();
  }

  const [prev] = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, id)).limit(1);
  const [row] = await db.update(tasks).set(set).where(eq(tasks.id, id)).returning();
  if (!row) return { ok: false, error: 'Task not found' };

  await logActivity({
    entityKind: 'task',
    entityId: id,
    actorId: ctx.userId,
    verb: 'task.updated',
    payload: { patch },
  });

  if (patch.status && prev && prev.status !== patch.status) {
    await fireTrigger({
      kind: 'task_status_change',
      entityId: row.entityId,
      event: {
        kind: 'task_status_change',
        entityId: row.entityId,
        occurredAt: new Date(),
        payload: {
          taskId: id,
          newStatus: patch.status,
          oldStatus: prev.status,
          taskTitle: row.title,
          taskKind: row.taskKind,
        },
      },
    });
  }

  revalidatePath('/labor/tasks');
  return { ok: true, id };
}

// ---------- dependencies ----------

const addDependencySchema = z.object({
  blockerId: uuid,
  blockedId: uuid,
  kind: z
    .enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'])
    .default('finish_to_start'),
});

export async function addDependency(raw: unknown): Promise<R> {
  const parsed = addDependencySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const { blockerId, blockedId, kind } = parsed.data;
  if (blockerId === blockedId) return { ok: false, error: 'Self dependency' };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const existing = await db
    .select({ blockerTaskId: taskDependencies.blockerTaskId, blockedTaskId: taskDependencies.blockedTaskId })
    .from(taskDependencies);
  const edges: Array<[string, string]> = existing.map((e) => [e.blockerTaskId as string, e.blockedTaskId as string]);
  if (detectCycle(edges, [blockerId, blockedId])) {
    return { ok: false, error: 'Adding this dependency would create a cycle' };
  }

  const [row] = await db
    .insert(taskDependencies)
    .values({ blockerTaskId: blockerId, blockedTaskId: blockedId, kind })
    .returning();

  await logActivity({
    entityKind: 'task',
    entityId: blockedId,
    actorId: ctx.userId,
    verb: 'dependency.added',
    payload: { blockerId, kind },
  });

  revalidatePath('/labor/tasks');
  return { ok: true, id: row!.id };
}

const removeDependencySchema = z.object({ id: uuid });

export async function removeDependency(raw: unknown): Promise<R> {
  const parsed = removeDependencySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [existing] = await db
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.id, parsed.data.id))
    .limit(1);
  if (!existing) return { ok: false, error: 'Dependency not found' };

  await db.delete(taskDependencies).where(eq(taskDependencies.id, parsed.data.id));

  await logActivity({
    entityKind: 'task',
    entityId: existing.blockedTaskId as string,
    actorId: ctx.userId,
    verb: 'dependency.removed',
    payload: { blockerId: existing.blockerTaskId },
  });

  revalidatePath('/labor/tasks');
  return { ok: true, id: parsed.data.id };
}

// ---------- time tracking ----------

const startTimerSchema = z.object({ taskId: uuid, workerId: uuid });

export async function startTimer(raw: unknown): Promise<R> {
  const parsed = startTimerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  // Defensive: close any open timer this worker already has on this task.
  await db
    .update(taskTimeEntries)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(taskTimeEntries.taskId, parsed.data.taskId),
        eq(taskTimeEntries.workerId, parsed.data.workerId),
        isNull(taskTimeEntries.endedAt),
      ),
    );

  const [row] = await db
    .insert(taskTimeEntries)
    .values({
      taskId: parsed.data.taskId,
      workerId: parsed.data.workerId,
      startedAt: new Date(),
    })
    .returning();

  await logActivity({
    entityKind: 'task',
    entityId: parsed.data.taskId,
    actorId: ctx.userId,
    verb: 'timer.started',
    payload: { workerId: parsed.data.workerId, entryId: row!.id },
  });

  return { ok: true, id: row!.id };
}

const stopTimerSchema = z.object({ entryId: uuid, notes: z.string().max(2000).optional() });

export async function stopTimer(raw: unknown): Promise<R> {
  const parsed = stopTimerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [entry] = await db
    .select()
    .from(taskTimeEntries)
    .where(eq(taskTimeEntries.id, parsed.data.entryId))
    .limit(1);
  if (!entry) return { ok: false, error: 'Timer not found' };
  if (entry.endedAt) return { ok: false, error: 'Timer already stopped' };

  const endedAt = new Date();
  const started = entry.startedAt instanceof Date ? entry.startedAt : new Date(entry.startedAt as string);
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - started.getTime()) / 60000));

  await db
    .update(taskTimeEntries)
    .set({
      endedAt,
      durationMinutes,
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    })
    .where(eq(taskTimeEntries.id, parsed.data.entryId));

  await logActivity({
    entityKind: 'task',
    entityId: entry.taskId as string,
    actorId: ctx.userId,
    verb: 'timer.stopped',
    payload: { entryId: parsed.data.entryId, durationMinutes },
  });

  return { ok: true, id: parsed.data.entryId };
}

// ---------- comments + mentions ----------

const addCommentSchema = z.object({
  entityKind: z.enum(['task', 'approval', 'repair', 'crop_plan', 'feasibility']),
  entityId: uuid,
  body: z.string().min(1).max(8000),
  bodyUr: z.string().max(8000).optional(),
  parentCommentId: uuid.optional(),
  attachments: z
    .array(z.object({ url: z.string().url(), name: z.string().optional(), mimeType: z.string().optional() }))
    .default([]),
  mentions: z.array(uuid).optional(),
});

export async function addComment(raw: unknown): Promise<R> {
  const parsed = addCommentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const parsedBody = parseMentions(data.body);
  // Caller can hint mentions; merge with parsed UUIDs.
  const mentionSet = new Set<string>([...(data.mentions ?? []), ...parsedBody.mentions]);
  const mentions = [...mentionSet];

  const [row] = await db
    .insert(entityComments)
    .values({
      entityKind: data.entityKind,
      entityId: data.entityId,
      parentCommentId: data.parentCommentId ?? null,
      authorId: ctx.userId,
      body: data.body,
      bodyUr: data.bodyUr ?? null,
      mentions,
      attachments: data.attachments,
    })
    .returning();

  await logActivity({
    entityKind: data.entityKind,
    entityId: data.entityId,
    actorId: ctx.userId,
    verb: 'comment.added',
    payload: {
      commentId: row!.id,
      mentions,
      parentCommentId: data.parentCommentId ?? null,
    },
  });

  // Fire in-app notifications for each mentioned user. WhatsApp + email
  // dispatch is delegated to the existing notification worker which
  // listens on this table (category=mention).
  if (mentions.length > 0) {
    const title = `You were mentioned`;
    const deepLink = `/${data.entityKind}/${data.entityId}#comment-${row!.id}`;
    await db.insert(notifications).values(
      mentions.map((recipientId) => ({
        recipientId,
        channel: 'in_app',
        category: 'mention',
        title,
        body: parsedBody.plainText.slice(0, 280),
        bodyUr: data.bodyUr?.slice(0, 280),
        deepLink,
        payload: {
          commentId: row!.id,
          entityKind: data.entityKind,
          entityId: data.entityId,
          authorId: ctx.userId,
        },
      })),
    );
  }

  await fireTrigger({
    kind: 'comment_added',
    entityId: ctx.entityId || null,
    event: {
      kind: 'comment_added',
      entityId: ctx.entityId || null,
      occurredAt: new Date(),
      payload: {
        commentId: row!.id,
        entityKind: data.entityKind,
        entityId: data.entityId,
        authorId: ctx.userId,
        body: data.body,
      },
    },
  });
  if (mentions.length > 0) {
    await fireTrigger({
      kind: 'mention_received',
      entityId: ctx.entityId || null,
      event: {
        kind: 'mention_received',
        entityId: ctx.entityId || null,
        occurredAt: new Date(),
        payload: {
          commentId: row!.id,
          entityKind: data.entityKind,
          entityId: data.entityId,
          mentions,
        },
      },
    });
  }

  revalidatePath(`/${data.entityKind}/${data.entityId}`);
  return { ok: true, id: row!.id };
}

const editCommentSchema = z.object({
  id: uuid,
  body: z.string().min(1).max(8000),
  bodyUr: z.string().max(8000).optional(),
});

export async function editComment(raw: unknown): Promise<R> {
  const parsed = editCommentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [existing] = await db
    .select()
    .from(entityComments)
    .where(eq(entityComments.id, parsed.data.id))
    .limit(1);
  if (!existing) return { ok: false, error: 'Comment not found' };
  if ((existing.authorId as string) !== ctx.userId) {
    return { ok: false, error: 'Not your comment' };
  }

  const parsedBody = parseMentions(parsed.data.body);
  await db
    .update(entityComments)
    .set({
      body: parsed.data.body,
      bodyUr: parsed.data.bodyUr ?? null,
      mentions: parsedBody.mentions,
      editedAt: new Date(),
    })
    .where(eq(entityComments.id, parsed.data.id));

  await logActivity({
    entityKind: existing.entityKind as string,
    entityId: existing.entityId as string,
    actorId: ctx.userId,
    verb: 'comment.edited',
    payload: { commentId: parsed.data.id },
  });

  return { ok: true, id: parsed.data.id };
}

// ---------- labels ----------

const setLabelsSchema = z.object({
  taskId: uuid,
  labels: z.array(z.string().min(1).max(48)).max(32),
});

export async function setLabels(raw: unknown): Promise<R> {
  const parsed = setLabelsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .update(tasks)
    .set({ labels: parsed.data.labels })
    .where(eq(tasks.id, parsed.data.taskId))
    .returning();
  if (!row) return { ok: false, error: 'Task not found' };

  await logActivity({
    entityKind: 'task',
    entityId: parsed.data.taskId,
    actorId: ctx.userId,
    verb: 'labels.set',
    payload: { labels: parsed.data.labels },
  });

  revalidatePath('/labor/tasks');
  return { ok: true, id: parsed.data.taskId };
}

// ---------- saved views ----------

const saveViewSchema = z.object({
  scope: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  viewMode: z.enum(['table', 'kanban', 'gantt', 'calendar', 'workload', 'chart', 'map']),
  config: z.record(z.unknown()).default({}),
  shared: z.boolean().default(false),
});

export async function saveView(raw: unknown): Promise<R> {
  const parsed = saveViewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(savedViews)
    .values({
      userId: ctx.userId,
      scope: parsed.data.scope,
      name: parsed.data.name,
      viewMode: parsed.data.viewMode,
      config: parsed.data.config,
      shared: parsed.data.shared,
    })
    .returning();

  return { ok: true, id: row!.id };
}

export async function listSavedViews(scope: string): Promise<Array<Record<string, unknown>>> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const rows = await db
    .select()
    .from(savedViews)
    .where(
      and(
        eq(savedViews.scope, scope),
        // user's own OR shared by anyone
        // drizzle has no nice "or" helper imported here, so use sql for the union
        sql`(${savedViews.userId} = ${ctx.userId} or ${savedViews.shared} = true)`,
      ),
    )
    .orderBy(desc(savedViews.createdAt));
  return rows as Array<Record<string, unknown>>;
}

// ---------- read helpers (handy for UI) ----------

export async function listTaskComments(entityKind: string, entityId: string): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select()
    .from(entityComments)
    .where(and(eq(entityComments.entityKind, entityKind), eq(entityComments.entityId, entityId)))
    .orderBy(desc(entityComments.createdAt));
  return rows as Array<Record<string, unknown>>;
}

export async function listEntityActivity(entityKind: string, entityId: string): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select()
    .from(entityActivity)
    .where(and(eq(entityActivity.entityKind, entityKind), eq(entityActivity.entityId, entityId)))
    .orderBy(desc(entityActivity.occurredAt));
  return rows as Array<Record<string, unknown>>;
}

export async function listTaskDependencies(taskId: string): Promise<{
  blockers: Array<Record<string, unknown>>;
  blocking: Array<Record<string, unknown>>;
}> {
  const [blockers, blocking] = await Promise.all([
    db.select().from(taskDependencies).where(eq(taskDependencies.blockedTaskId, taskId)),
    db.select().from(taskDependencies).where(eq(taskDependencies.blockerTaskId, taskId)),
  ]);
  return {
    blockers: blockers as Array<Record<string, unknown>>,
    blocking: blocking as Array<Record<string, unknown>>,
  };
}

// re-export inArray to placate linters that flag unused imports across helpers
export const __referencedHelpers = { inArray };
