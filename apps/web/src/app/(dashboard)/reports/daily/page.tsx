import { db, tasks, attendanceRecords, marketPrices, weatherRecords } from '@zameen/db';
import { desc, gte, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, StatBlock } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DailyReport() {
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = await db.select().from(tasks).where(eq(tasks.scheduledFor, today)).limit(50);
  const present = await db.select().from(attendanceRecords).where(eq(attendanceRecords.workDate, today));
  const prices = await db.select().from(marketPrices).where(eq(marketPrices.recordedOn, today)).limit(10);
  const weather = await db.select().from(weatherRecords).where(eq(weatherRecords.recordedFor, today)).limit(1);
  const w = weather[0];

  return (
    <div>
      <Masthead section="DAILY OPS" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)] mb-6">
        <StatBlock label="Tasks today" value={todayTasks.length} />
        <StatBlock label="Present" value={present.filter((p) => p.status === 'present').length} />
        <StatBlock label="Min / Max °C" value={w ? `${w.minTempC} / ${w.maxTempC}` : '—'} />
        <StatBlock label="Rainfall mm" value={w?.rainfallMm ?? '—'} />
      </div>
      <Card>
        <CardHeader><CardTitle>Today's tasks · {fmtDate(today)}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {todayTasks.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No tasks scheduled.</div> : (
            <ul>{todayTasks.map((t) => (
              <li key={t.id} className="px-4 py-2 border-t border-[var(--rule)] first:border-0 text-sm">
                <span className="smallcaps text-[var(--ochre)] text-[0.7rem] mr-2">{t.taskKind}</span>{t.title}
              </li>
            ))}</ul>
          )}
        </CardContent>
      </Card>
      <SectionDivider label="Market prices today" />
      <Card>
        <CardContent className="p-0">
          {prices.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No prices logged.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Commodity</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Mandi</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Mode</th>
              </tr></thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{p.commodity}</td>
                    <td className="px-3 py-2">{p.market}</td>
                    <td className="px-3 py-2 text-right tabular">{p.modePkr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
