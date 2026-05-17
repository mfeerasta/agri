import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db, tasks, fields } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead } from '@zameen/ui';
import { getFieldSession } from '../../../lib/session';
import { TaskCompleteForm } from './task-complete-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TaskDetail({ params }: Props) {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  const { id } = await params;

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      titleUr: tasks.titleUr,
      description: tasks.description,
      estimatedHours: tasks.estimatedHours,
      status: tasks.status,
      fieldCode: fields.code,
      fieldName: fields.name,
      fieldNameUr: fields.nameUr,
    })
    .from(tasks)
    .leftJoin(fields, eq(fields.id, tasks.fieldId))
    .where(eq(tasks.id, id))
    .limit(1);

  const task = rows[0];
  if (!task) notFound();

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/tasks" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Tasks</Link>
      <Masthead section="Task" />
      <div>
        <div className="smallcaps text-[0.72rem] text-[var(--ochre)]">{task.fieldCode ?? '—'} · {task.fieldNameUr ?? task.fieldName ?? ''}</div>
        <h1 className="urdu text-2xl mt-1">{task.titleUr ?? task.title}</h1>
        {task.description ? <p className="mt-2 text-sm">{task.description}</p> : null}
        {task.estimatedHours ? (
          <p className="mt-2 tabular text-xs text-[var(--ink)]/60">Est: {task.estimatedHours} h</p>
        ) : null}
      </div>

      {task.status === 'completed' ? (
        <div className="border border-[var(--zameen-700)] bg-[var(--paper-2)] p-3 text-sm">
          ✓ Already completed
        </div>
      ) : (
        <TaskCompleteForm taskId={task.id} />
      )}
    </main>
  );
}
