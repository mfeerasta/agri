import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import {
  db,
  workerScorePeriods,
  attendanceRecords,
  taskCompletions,
  pieceRateLogs,
  tasks,
} from '@zameen/db';
import { Masthead } from '@zameen/ui';
import { getFieldSession } from '../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function MyScorePage() {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  if (!session.workerId) redirect('/profile');
  const workerId = session.workerId;

  const [latest] = await db
    .select()
    .from(workerScorePeriods)
    .where(eq(workerScorePeriods.workerId, workerId))
    .orderBy(desc(workerScorePeriods.periodStart))
    .limit(1);

  let totalInPeriod = 0;
  if (latest) {
    const peers = await db
      .select()
      .from(workerScorePeriods)
      .where(
        and(
          eq(workerScorePeriods.entityId, latest.entityId as string),
          eq(workerScorePeriods.periodStart, latest.periodStart as string),
          eq(workerScorePeriods.periodEnd, latest.periodEnd as string),
        ),
      );
    totalInPeriod = peers.length;
  }

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const recentAttendance = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workerId, workerId),
        gte(attendanceRecords.workDate, weekAgo),
        lte(attendanceRecords.workDate, todayIso),
      ),
    );

  const recentCompletions = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.workerId, workerId))
    .orderBy(desc(taskCompletions.completedAt))
    .limit(7);

  const taskIds = Array.from(new Set(recentCompletions.map((c) => c.taskId as string)));
  const taskRows = taskIds.length ? await db.select().from(tasks).where(inArray(tasks.id, taskIds)) : [];
  const taskMap = new Map<string, (typeof taskRows)[number]>();
  for (const t of taskRows) taskMap.set(t.id as string, t);

  const recentPieces = await db
    .select()
    .from(pieceRateLogs)
    .where(
      and(
        eq(pieceRateLogs.workerId, workerId),
        gte(pieceRateLogs.workDate, weekAgo),
        lte(pieceRateLogs.workDate, todayIso),
      ),
    );

  const score = latest ? Number(latest.compositeScore) : 0;
  const rank = latest?.rankInPeriod ?? null;
  const daysPresent = (latest?.daysPresent as number | undefined) ?? 0;
  const tasksDone = (latest?.tasksCompleted as number | undefined) ?? 0;
  const pieceEarn = Number(latest?.pieceRateTotalPkr ?? 0);

  const activityItems: Array<{ when: string; label: string }> = [];
  for (const a of recentAttendance) {
    if (a.status === 'present' || a.status === 'half_day') {
      activityItems.push({ when: a.workDate as string, label: 'حاضری · Present' });
    }
  }
  for (const c of recentCompletions) {
    const t = taskMap.get(c.taskId as string);
    const date = new Date(c.completedAt as unknown as string).toISOString().slice(0, 10);
    activityItems.push({ when: date, label: `کام مکمل · ${t?.titleUr ?? t?.title ?? 'Task done'}` });
  }
  for (const p of recentPieces) {
    activityItems.push({
      when: p.workDate as string,
      label: `پیس ریٹ · ${Number(p.quantity).toFixed(1)} ${p.unit as string}`,
    });
  }
  activityItems.sort((a, b) => (a.when > b.when ? -1 : 1));

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/profile" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">
        ← پروفائل
      </Link>
      <Masthead section="میرا سکور" />

      <section
        className="border p-4 text-center"
        style={{
          borderColor: 'var(--rule)',
          background: `color-mix(in srgb, var(--accent) 14%, var(--paper))`,
        }}
      >
        <div className="urdu text-sm text-[var(--ink)]/80">آپ کا ماہانہ سکور</div>
        <div className="tabular text-6xl font-display my-2">{score.toFixed(1)}</div>
        <div className="text-xs text-[var(--ink)]/70">
          {rank && totalInPeriod
            ? <>درجہ · {rank} / {totalInPeriod}</>
            : <span className="urdu">ابھی حساب نہیں ہوا</span>}
        </div>
        {latest?.bonusEligible ? (
          <div className="mt-3 urdu text-sm" style={{ color: 'var(--accent)' }}>
            مبارک ہو! آپ بونس کے حقدار ہیں۔
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-3 gap-2">
        <div className="border border-[var(--rule)] p-3 text-center">
          <div className="urdu text-[0.7rem] text-[var(--ink)]/70">حاضری</div>
          <div className="tabular text-xl font-display mt-1">{daysPresent}</div>
          <div className="urdu text-[0.65rem] text-[var(--ink)]/50">دن</div>
        </div>
        <div className="border border-[var(--rule)] p-3 text-center">
          <div className="urdu text-[0.7rem] text-[var(--ink)]/70">کام</div>
          <div className="tabular text-xl font-display mt-1">{tasksDone}</div>
          <div className="urdu text-[0.65rem] text-[var(--ink)]/50">مکمل</div>
        </div>
        <div className="border border-[var(--rule)] p-3 text-center">
          <div className="urdu text-[0.7rem] text-[var(--ink)]/70">پیس ریٹ</div>
          <div className="tabular text-lg font-display mt-1">{pieceEarn.toFixed(0)}</div>
          <div className="urdu text-[0.65rem] text-[var(--ink)]/50">روپے</div>
        </div>
      </div>

      <section className="border-t border-[var(--rule)] pt-3">
        <div className="urdu smallcaps text-[0.72rem] text-[var(--ink)]/70 mb-2">پچھلے سات دن</div>
        {activityItems.length === 0 ? (
          <div className="urdu text-sm text-[var(--ink)]/50">ابھی کوئی سرگرمی نہیں۔</div>
        ) : (
          <ul className="space-y-2">
            {activityItems.slice(0, 12).map((a, i) => (
              <li
                key={`${a.when}-${i}`}
                className="flex justify-between text-sm border-b border-[var(--rule)] pb-1"
              >
                <span className="urdu">{a.label}</span>
                <span className="tabular text-xs text-[var(--ink)]/60">{a.when}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="urdu text-xs text-[var(--ink)]/60 border-t border-[var(--rule)] pt-3 leading-relaxed">
        یہ سکور ہر مہینے کی 2 تاریخ کو حساب ہوتا ہے۔ زیادہ حاضری، زیادہ کام اور پیس ریٹ سے سکور بڑھتا ہے۔ شاباش!
      </section>
    </main>
  );
}
