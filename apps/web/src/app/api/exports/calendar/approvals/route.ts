import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db, approvalRequests } from '@zameen/db';
import { buildIcs, icsResponseHeaders, type IcsEvent } from '@zameen/shared';
import { authCalendarRequest } from '../lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEEP_LINK_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://agri.feerasta.ai';
const PENDING_STATES = ['submitted', 'in_review', 'escalated'] as const;

export async function GET(req: NextRequest) {
  const auth = await authCalendarRequest(req, 'approvals');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rows = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.entityId, auth.entityId),
        inArray(approvalRequests.state, PENDING_STATES as unknown as string[]),
      ),
    );

  const now = new Date();
  const events: IcsEvent[] = rows.flatMap((r) => {
    const evts: IcsEvent[] = [];
    const created = r.submittedAt ? new Date(r.submittedAt as unknown as string) : now;
    evts.push({
      uid: `approval-${r.id}-pending@agri.feerasta.ai`,
      summary: `Approval needed: ${r.title}`,
      description: `Type ${r.approvalType}. Amount ${r.amountPkr ?? 'n/a'}. State ${r.state}.`,
      startDateTime: created,
      endDateTime: new Date(created.getTime() + 30 * 60 * 1000),
      url: `${DEEP_LINK_BASE}/approvals/${r.id}`,
      reminderMinutes: 0,
    });
    if (r.nextEscalationAt) {
      const esc = new Date(r.nextEscalationAt as unknown as string);
      evts.push({
        uid: `approval-${r.id}-escalation@agri.feerasta.ai`,
        summary: `Escalation deadline: ${r.title}`,
        description: 'Approval will auto-escalate at this time.',
        startDateTime: esc,
        endDateTime: new Date(esc.getTime() + 15 * 60 * 1000),
        url: `${DEEP_LINK_BASE}/approvals/${r.id}`,
        reminderMinutes: 60,
      });
    }
    return evts;
  });

  const ics = buildIcs(events, { calendarName: 'Zameen Approvals' });
  return new Response(ics, { headers: icsResponseHeaders('zameen-approvals.ics') });
}
