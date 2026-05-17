'use server';
import { revalidatePath } from 'next/cache';
import { db, taskAssignments } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; count: number } | { ok: false; error: string };

export async function assignWorkers({
  taskId,
  workerIds,
}: {
  taskId: string;
  workerIds: string[];
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (workerIds.length === 0) return { ok: false, error: 'Pick at least one worker' };

  await db
    .insert(taskAssignments)
    .values(workerIds.map((wid) => ({ taskId, workerId: wid })))
    .onConflictDoNothing();

  revalidatePath('/assign');
  return { ok: true, count: workerIds.length };
}
