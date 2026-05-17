// Stub for Google Calendar push. Phase 2 will fill in real OAuth + event
// creation; for now the action handler in @zameen/automations can call this
// and get a deterministic no-op success so workflows can be authored.

export interface GoogleCalendarEvent {
  calendarId: string;
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees?: string[];
}

export interface GoogleCalendarResult {
  ok: boolean;
  detail?: string;
  eventId?: string;
}

export async function pushCalendarEvent(_event: GoogleCalendarEvent): Promise<GoogleCalendarResult> {
  // TODO Phase 2: wire OAuth refresh-token flow and call calendar.events.insert.
  return { ok: false, detail: 'google-calendar integration not configured yet' };
}
