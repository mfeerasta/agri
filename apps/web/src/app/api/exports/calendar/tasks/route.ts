import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { db, tasks, taskAssignments } from '@zameen/db';
import { buildIcs, icsResponseHeaders, type IcsEvent } from '@zameen/shared';
import { authCalendarRequest, parseDateRange } from '../lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEEP_LINK_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://agri.feerasta.ai';

export async function GET(req: NextRequest) {
  const auth = await authCalendarRequest(req, 'tasks');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { from, to } = parseDateRange(req);
  const url = new URL(req.url);
  const assignee = url.searchParams.get('assignee');

  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);

  let taskIds: string[] | null = null;
  if (assignee) {
    const assn = await db
      .select({ taskId: taskAssignments.taskId })
      .from(taskAssignments)
      .where(eq(taskAssignments.workerId, assignee));
    taskIds = assn.map((a) => a.taskId);
    if (taskIds.length === 0) {
      return new Response(buildIcs([], { calendarName: 'Zameen Tasks' }), {
        headers: icsResponseHeaders('zameen-tasks.ics'),
      });
    }
  }

  const where = and(
    eq(tasks.entityId, auth.entityId),
    gte(tasks.scheduledFor, fromDate),
    lte(tasks.scheduledFor, toDate),
    taskIds ? inArray(tasks.id, taskIds) : undefined,
  );

  const rows = await db.select().from(tasks).where(where);

  const events: IcsEvent[] = rows
    .filter((r) => r.scheduledFor)
    .map((r) => {
      const start = new Date(r.scheduledFor as unknown as string);
      const hours = r.estimatedHours ? Number(r.estimatedHours) : 1;
      const end = new Date(start.getTime() + Math.max(0.5, hours) * 60 * 60 * 1000);
      const desc = [
        r.description,
        r.taskKind ? `Kind: ${r.taskKind}` : null,
        r.status ? `Status: ${r.status}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      return {
        uid: `${r.id}@agri.feerasta.ai`,
        summary: r.title,
        description: desc || undefined,
        startDateTime: start,
        endDateTime: end,
        url: `${DEEP_LINK_BASE}/labor/tasks?task=${r.id}`,
        reminderMinutes: 60,
      };
    });

  const ics = buildIcs(events, { calendarName: 'Zameen Tasks' });
  return new Response(ics, { headers: icsResponseHeaders('zameen-tasks.ics') });
}
