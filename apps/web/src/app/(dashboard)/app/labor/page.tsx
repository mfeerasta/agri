import Link from 'next/link';
import { desc, eq, and, sql as dsql } from 'drizzle-orm';
import { db, workers, attendanceRecords } from '@zameen/db';
import { Masthead, SectionDivider, StatBlock, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { t } from '@zameen/locale';
import { fmtDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function LaborHome() {
  const locale = await getLocale();
  const today = new Date().toISOString().slice(0, 10);
  const totalWorkers = await db.select({ c: dsql<number>`count(*)::int` }).from(workers).where(eq(workers.isActive, true));
  const present = await db
    .select({ c: dsql<number>`count(*)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workDate, today), eq(attendanceRecords.status, 'present')));
  const recentAttendance = await db
    .select()
    .from(attendanceRecords)
    .orderBy(desc(attendanceRecords.checkInAt))
    .limit(15);

  const total = totalWorkers[0]?.c ?? 0;
  const here = present[0]?.c ?? 0;
  const timeTag = locale === 'ur' ? 'ur-PK' : 'en-GB';

  return (
    <div>
      <Masthead section={t('labor.title', locale)} />
      <SectionDivider />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label={t('labor.active', locale)} value={total} />
        <StatBlock label={t('labor.present_today', locale)} value={`${here} / ${total}`} caption="Geofence" />
        <StatBlock label={t('labor.open_tasks', locale)} value="—" />
        <StatBlock label={t('labor.payroll_due', locale)} value="—" caption={t('labor.this_period', locale)} />
      </div>
      <SectionDivider label={t('labor.quick_actions', locale)} />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={'/labor/workers' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">{t('labor.workers', locale)}</div><div className="font-display text-xl mt-1">{t('labor.roster', locale)}</div></Link>
        <Link href={'/labor/attendance' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">{t('labor.attendance', locale)}</div><div className="font-display text-xl mt-1">{t('action.view', locale)}</div></Link>
        <Link href={'/labor/piece-rate/new' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">{t('labor.piece_rate', locale)}</div><div className="font-display text-xl mt-1">{t('action.new', locale)}</div></Link>
        <Link href={'/labor/payroll' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">{t('labor.payroll', locale)}</div><div className="font-display text-xl mt-1">{t('action.view', locale)}</div></Link>
        <Link href={'/labor/labour-cost-log' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">مزدوری لاگت / Labour cost</div><div className="font-display text-xl mt-1">Daily matrix</div></Link>
        <Link href={'/labor/training' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">تربیت / Training</div><div className="font-display text-xl mt-1">Matrix</div></Link>
        <Link href={'/labor/safety' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">حفاظت / Safety</div><div className="font-display text-xl mt-1">Hub</div></Link>
        <Link href={'/labor/ppe' as never} className="border border-[var(--rule)] p-4 hover:bg-[var(--paper-2)]"><div className="smallcaps text-xs">حفاظتی سامان / PPE</div><div className="font-display text-xl mt-1">Register</div></Link>
      </div>
      <SectionDivider label={t('labor.recent_attendance', locale)} />
      <Card>
        <CardHeader><CardTitle>{t('labor.last_checkins', locale)}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recentAttendance.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">{t('labor.no_attendance', locale)}.</div>
          ) : (
            <div className="overflow-x-auto">
              <ul className="min-w-full">
                {recentAttendance.map((r) => (
                  <li key={r.id} className="flex justify-between border-t border-[var(--rule)] px-4 py-3 md:py-2 first:border-t-0 text-sm">
                    <span className="font-mono">{fmtDate(r.workDate, locale)} · {r.status}</span>
                    <span className="tabular text-[var(--ink)]/60">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString(timeTag, { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
