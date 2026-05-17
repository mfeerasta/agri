'use server';
import { revalidatePath } from 'next/cache';
import { db, tasks, taskAssignments, taskCompletions, workers } from '@zameen/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getFieldSession } from '../../lib/session';

async function workerIdFor(userId: string, entityId: string): Promise<string | null> {
  const rows = await db
    .select({ id: workers.id })
    .from(workers)
    .where(and(eq(workers.userId, userId), eq(workers.entityId, entityId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

const completeSchema = z.object({
  taskId: z.string().uuid(),
  hoursWorked: z.coerce.number().nonnegative(),
  notes: z.string().max(2000).optional(),
  proofPhotoUrls: z.array(z.string().url()).min(1, 'At least one proof photo required'),
});

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function completeTask(raw: unknown): Promise<Result> {
  const parsed = completeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;

  const session = await getFieldSession();
  if (!session) return { ok: false, error: 'Not authenticated' };
  const workerId = session.workerId ?? (await workerIdFor(session.userId, session.entityId));
  if (!workerId) return { ok: false, error: 'Worker record not found' };

  const [row] = await db
    .insert(taskCompletions)
    .values({
      taskId: data.taskId,
      workerId,
      hoursWorked: data.hoursWorked.toString(),
      notes: data.notes ?? null,
      proofPhotoUrls: data.proofPhotoUrls,
    })
    .returning();

  await db.update(tasks).set({ status: 'completed' }).where(eq(tasks.id, data.taskId));

  revalidatePath('/tasks');
  revalidatePath(`/tasks/${data.taskId}`);
  return { ok: true, id: row!.id };
}
