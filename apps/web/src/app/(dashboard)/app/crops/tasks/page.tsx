import { db, cropPlans, cropProfiles, fields } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface StageRow {
  stage: string;
  offsetDays: number;
  label?: string;
}

export default async function TasksCalendarPage() {
  const plans = await db
    .select({
      id: cropPlans.id,
      plannedAcres: cropPlans.plannedAcres,
      plannedSowingDate: cropPlans.plannedSowingDate,
      cropName: cropProfiles.name,
      stageTimeline: cropProfiles.stageTimeline,
      fieldCode: fields.code,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId));

  const events: Array<{ date: string; planId: string; title: string; fieldCode: string; acres: string }> = [];
  for (const p of plans) {
    if (!p.plannedSowingDate || !Array.isArray(p.stageTimeline)) continue;
    const sow = new Date(p.plannedSowingDate);
    for (const stage of p.stageTimeline as StageRow[]) {
      const d = new Date(sow.getTime() + stage.offsetDays * 86_400_000);
      events.push({
        date: d.toISOString().slice(0, 10),
        planId: p.id,
        title: stage.label ?? stage.stage,
        fieldCode: p.fieldCode ?? '',
        acres: Number(p.plannedAcres).toFixed(2),
      });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  const groups = events.reduce((acc, e) => {
    if (!acc.has(e.date)) acc.set(e.date, []);
    acc.get(e.date)!.push(e);
    return acc;
  }, new Map<string, typeof events>());

  return (
    <div className="space-y-2">
      <Masthead section="TASKS" />
      <SectionDivider />
      {events.length === 0 ? <EmptyState title="No scheduled tasks" /> : null}
      {Array.from(groups.entries()).map(([date, list]) => (
        <Card key={date}>
          <CardContent className="p-0">
            <div className="border-b border-[var(--rule)] bg-slate-50 px-5 py-2 text-xs uppercase text-slate-500">
              {fmtDate(date)}
            </div>
            <ul>
              {list.map((e, i) => (
                <li key={`${e.planId}-${i}`} className="flex items-baseline justify-between px-5 py-3">
                  <span className="flex items-baseline gap-3">
                    <span className="smallcaps text-[0.7rem] text-[var(--ochre)]">{e.fieldCode}</span>
                    <span>{e.title}</span>
                  </span>
                  <span className="tabular text-xs text-slate-500">{e.acres} ac</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
