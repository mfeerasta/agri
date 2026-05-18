import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { listMyCalendarTokens } from '@/modules/calendars/actions';
import { CalendarTokensClient } from './calendar-tokens-client';

export const dynamic = 'force-dynamic';

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://agri.feerasta.ai';

const SCOPE_TO_PATH: Record<string, string> = {
  tasks: '/api/exports/calendar/tasks',
  crop_plans: '/api/exports/calendar/crop-plan',
  approvals: '/api/exports/calendar/approvals',
  feasibilities: '/api/exports/calendar/feasibility-reviews',
  all: '/api/exports/calendar/tasks',
};

export default async function CalendarTokensPage() {
  const rows = await listMyCalendarTokens();
  const enriched = rows.map((r) => ({
    id: r.id,
    scope: r.scope,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    expiresAt:
      r.expiresAt instanceof Date ? r.expiresAt.toISOString() : r.expiresAt ? String(r.expiresAt) : null,
    lastAccessedAt:
      r.lastAccessedAt instanceof Date
        ? r.lastAccessedAt.toISOString()
        : r.lastAccessedAt
          ? String(r.lastAccessedAt)
          : null,
    subscribeUrl: `${WEB_BASE}${SCOPE_TO_PATH[r.scope] ?? SCOPE_TO_PATH.tasks}?live=true&token=${r.token}`,
  }));

  return (
    <div>
      <Masthead section="CALENDAR TOKENS" />
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>Subscribe URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[var(--ink)]/70">
            Create a token to subscribe to a live iCal feed from Outlook, Google Calendar, or Apple
            Calendar. Subscribed calendars refresh automatically.
          </p>
          <CalendarTokensClient tokens={enriched} />
        </CardContent>
      </Card>
    </div>
  );
}
