import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@zameen/db';
import { buildIcs, icsResponseHeaders, type IcsEvent } from '@zameen/shared';
import { authCalendarRequest } from '../lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEEP_LINK_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://agri.feerasta.ai';

interface FeasibilityRow {
  id: string;
  title: string | null;
  post_execution_review_date: string | null;
}

export async function GET(req: NextRequest) {
  const auth = await authCalendarRequest(req, 'feasibilities');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const now = new Date();
  const horizon = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Query the feasibility_studies table directly; the data model exists but no drizzle table is wired.
  let rows: FeasibilityRow[] = [];
  try {
    const result = await db.execute(sql`
      select id::text, title, post_execution_review_date::text
      from zameen.feasibility_studies
      where entity_id = ${auth.entityId}
        and post_execution_review_date is not null
        and post_execution_review_date >= ${now.toISOString().slice(0, 10)}
        and post_execution_review_date <= ${horizon.toISOString().slice(0, 10)}
    `);
    rows = ((result as unknown as { rows?: FeasibilityRow[] }).rows ?? []) as FeasibilityRow[];
  } catch {
    rows = [];
  }

  const events: IcsEvent[] = rows
    .filter((r) => r.post_execution_review_date)
    .map((r) => {
      const d = new Date(`${r.post_execution_review_date}T10:00:00+05:00`);
      return {
        uid: `feasibility-${r.id}-review@agri.feerasta.ai`,
        summary: `Feasibility review: ${r.title ?? 'Untitled'}`,
        description: 'Post-execution review of feasibility study.',
        startDateTime: d,
        endDateTime: new Date(d.getTime() + 60 * 60 * 1000),
        url: `${DEEP_LINK_BASE}/feasibilities/${r.id}`,
        reminderMinutes: 7 * 24 * 60,
      };
    });

  const ics = buildIcs(events, { calendarName: 'Zameen Feasibility Reviews' });
  return new Response(ics, { headers: icsResponseHeaders('zameen-feasibility-reviews.ics') });
}
