import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db, tasks, taskAssignments, workers, fields } from '@zameen/db';
import { and, eq } from 'drizzle-orm';
import { Masthead } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getFieldSession } from '../../lib/session';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function TasksPage() {
  const session = await getFieldSession();
  if (!session) redirect('/login');

  let workerId = session.workerId;
  if (!workerId) {
    const rows = await db
      .select({ id: workers.id })
      .from(workers)
      .where(and(eq(workers.userId, session.userId), eq(workers.entityId, session.entityId)))
      .limit(1);
    workerId = rows[0]?.id ?? null;
  }

  const locale = 'ur';
  const rows = workerId
    ? await db
        .select({
          id: tasks.id,
          title: tasks.title,
          titleUr: tasks.titleUr,
          estimatedHours: tasks.estimatedHours,
          status: tasks.status,
          fieldCode: fields.code,
          fieldName: fields.name,
          fieldNameUr: fields.nameUr,
        })
        .from(tasks)
        .innerJoin(taskAssignments, eq(taskAssignments.taskId, tasks.id))
        .leftJoin(fields, eq(fields.id, tasks.fieldId))
        .where(
          and(
            eq(taskAssignments.workerId, workerId),
            eq(tasks.scheduledFor, todayIso()),
          ),
        )
    : [];

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Home</Link>
      <Masthead section={t('task.list', locale)} />
      {rows.length === 0 ? (
        <p className="text-center text-[var(--ink)]/60 py-12">{t('task.no_tasks', locale)}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/tasks/${r.id}`} className="block border border-[var(--rule)] p-4 min-h-[64px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="smallcaps text-[0.72rem] text-[var(--ochre)]">{r.fieldCode ?? '—'}</span>
                  {r.estimatedHours ? (
                    <span className="tabular text-xs text-[var(--ink)]/60">{r.estimatedHours} h</span>
                  ) : null}
                </div>
                <div className="urdu text-base mt-1">{r.titleUr ?? r.title}</div>
                <div className="text-xs text-[var(--ink)]/50">{r.fieldNameUr ?? r.fieldName ?? ''}</div>
                {r.status === 'completed' ? (
                  <div className="text-xs text-[var(--zameen-700)] mt-1">✓ {t('form.submit_success', locale)}</div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
