import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, cropPlans, cropStageLogs, tasks } from '@zameen/db';
import { buildIcs, icsResponseHeaders, type IcsEvent } from '@zameen/shared';
import { authCalendarRequest } from '../../lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEEP_LINK_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://agri.feerasta.ai';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authCalendarRequest(req, 'crop_plans');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [plan] = await db.select().from(cropPlans).where(eq(cropPlans.id, id)).limit(1);
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const stages = await db.select().from(cropStageLogs).where(eq(cropStageLogs.cropPlanId, id));
  const planTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.entityId, auth.entityId), eq(tasks.cropPlanId, id)));

  const events: IcsEvent[] = [];

  if (plan.plannedSowingDate) {
    const d = new Date(plan.plannedSowingDate as unknown as string);
    events.push({
      uid: `crop-${plan.id}-sowing@agri.feerasta.ai`,
      summary: `Sowing: ${plan.varietyName ?? plan.seasonLabel}`,
      description: `Planned sowing for ${plan.seasonLabel}. ${plan.plannedAcres} acres.`,
      startDateTime: d,
      endDateTime: new Date(d.getTime() + 4 * 60 * 60 * 1000),
      url: `${DEEP_LINK_BASE}/crops/${plan.id}`,
      reminderMinutes: 24 * 60,
    });
  }
  if (plan.plannedHarvestDate) {
    const d = new Date(plan.plannedHarvestDate as unknown as string);
    events.push({
      uid: `crop-${plan.id}-harvest@agri.feerasta.ai`,
      summary: `Harvest: ${plan.varietyName ?? plan.seasonLabel}`,
      description: `Planned harvest. Expected ${plan.expectedYieldPerAcre ?? 'TBD'} per acre.`,
      startDateTime: d,
      endDateTime: new Date(d.getTime() + 8 * 60 * 60 * 1000),
      url: `${DEEP_LINK_BASE}/crops/${plan.id}`,
      reminderMinutes: 7 * 24 * 60,
    });
  }
  for (const log of stages) {
    const d = new Date(log.observedOn as unknown as string);
    events.push({
      uid: `crop-${plan.id}-stage-${log.id}@agri.feerasta.ai`,
      summary: `Stage: ${log.stage}`,
      description: log.notes ?? undefined,
      startDateTime: d,
      endDateTime: new Date(d.getTime() + 60 * 60 * 1000),
      url: `${DEEP_LINK_BASE}/crops/${plan.id}`,
    });
  }
  for (const task of planTasks) {
    if (!task.scheduledFor) continue;
    const d = new Date(task.scheduledFor as unknown as string);
    const hours = task.estimatedHours ? Number(task.estimatedHours) : 1;
    events.push({
      uid: `${task.id}@agri.feerasta.ai`,
      summary: task.title,
      description: task.description ?? undefined,
      startDateTime: d,
      endDateTime: new Date(d.getTime() + Math.max(0.5, hours) * 60 * 60 * 1000),
      url: `${DEEP_LINK_BASE}/labor/tasks?task=${task.id}`,
      reminderMinutes: 60,
    });
  }

  const ics = buildIcs(events, { calendarName: `Crop Plan ${plan.seasonLabel}` });
  return new Response(ics, { headers: icsResponseHeaders(`zameen-crop-${plan.id}.ics`) });
}
