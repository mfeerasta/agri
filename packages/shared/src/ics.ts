// RFC 5545 compliant ICS calendar builder.
// Hand-rolled: no dependencies. CRLF line endings. Properly escaped text values.

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startDateTime: Date;
  endDateTime: Date;
  organizerEmail?: string;
  attendeeEmails?: string[];
  url?: string;
  reminderMinutes?: number;
}

export interface IcsBuildOptions {
  calendarName?: string;
  timezone?: string;
  prodId?: string;
}

const CRLF = '\r\n';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Pacific Karachi is fixed UTC+5, no DST. Format as floating local time with TZID.
function toLocalKarachi(d: Date): string {
  // Convert to PKT (UTC+5) wall clock
  const utcMs = d.getTime();
  const pkt = new Date(utcMs + 5 * 60 * 60 * 1000);
  const y = pkt.getUTCFullYear();
  const mo = pad2(pkt.getUTCMonth() + 1);
  const da = pad2(pkt.getUTCDate());
  const h = pad2(pkt.getUTCHours());
  const mi = pad2(pkt.getUTCMinutes());
  const s = pad2(pkt.getUTCSeconds());
  return `${y}${mo}${da}T${h}${mi}${s}`;
}

function toUtcStamp(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const da = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}

// Escape RFC 5545 TEXT value: backslash, semicolon, comma, newline.
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// RFC 5545 line folding: lines longer than 75 octets get folded with CRLF + space.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (i === 0) {
      out.push(line.slice(0, 75));
      i = 75;
    } else {
      out.push(' ' + line.slice(i, i + 74));
      i += 74;
    }
  }
  return out.join(CRLF);
}

function emit(parts: string[], key: string, value: string): void {
  parts.push(foldLine(`${key}:${value}`));
}

function emitParam(parts: string[], key: string, params: Record<string, string>, value: string): void {
  const paramStr = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
  parts.push(foldLine(`${key};${paramStr}:${value}`));
}

function buildKarachiVtimezone(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Karachi',
    'X-LIC-LOCATION:Asia/Karachi',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0500',
    'TZOFFSETTO:+0500',
    'TZNAME:PKT',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

export function buildIcs(events: IcsEvent[], options: IcsBuildOptions = {}): string {
  const { calendarName = 'Zameen', timezone = 'Asia/Karachi', prodId = '-//Zameen//Agri//EN' } = options;
  const parts: string[] = [];
  parts.push('BEGIN:VCALENDAR');
  emit(parts, 'VERSION', '2.0');
  emit(parts, 'PRODID', prodId);
  emit(parts, 'CALSCALE', 'GREGORIAN');
  emit(parts, 'METHOD', 'PUBLISH');
  emit(parts, 'X-WR-CALNAME', escapeText(calendarName));
  emit(parts, 'X-WR-TIMEZONE', timezone);

  if (timezone === 'Asia/Karachi') {
    parts.push(...buildKarachiVtimezone());
  }

  const stamp = toUtcStamp(new Date());

  for (const ev of events) {
    parts.push('BEGIN:VEVENT');
    emit(parts, 'UID', ev.uid);
    emit(parts, 'DTSTAMP', stamp);
    if (timezone === 'Asia/Karachi') {
      emitParam(parts, 'DTSTART', { TZID: 'Asia/Karachi' }, toLocalKarachi(ev.startDateTime));
      emitParam(parts, 'DTEND', { TZID: 'Asia/Karachi' }, toLocalKarachi(ev.endDateTime));
    } else {
      emit(parts, 'DTSTART', toUtcStamp(ev.startDateTime));
      emit(parts, 'DTEND', toUtcStamp(ev.endDateTime));
    }
    emit(parts, 'SUMMARY', escapeText(ev.summary));
    if (ev.description) emit(parts, 'DESCRIPTION', escapeText(ev.description));
    if (ev.location) emit(parts, 'LOCATION', escapeText(ev.location));
    if (ev.url) emit(parts, 'URL', ev.url);
    if (ev.organizerEmail) emit(parts, 'ORGANIZER', `mailto:${ev.organizerEmail}`);
    if (ev.attendeeEmails) {
      for (const a of ev.attendeeEmails) {
        parts.push(foldLine(`ATTENDEE;CN=${a}:mailto:${a}`));
      }
    }
    if (typeof ev.reminderMinutes === 'number' && ev.reminderMinutes > 0) {
      parts.push('BEGIN:VALARM');
      emit(parts, 'ACTION', 'DISPLAY');
      emit(parts, 'DESCRIPTION', escapeText(ev.summary));
      emit(parts, 'TRIGGER', `-PT${Math.round(ev.reminderMinutes)}M`);
      parts.push('END:VALARM');
    }
    parts.push('END:VEVENT');
  }

  parts.push('END:VCALENDAR');
  return parts.join(CRLF) + CRLF;
}

export function icsResponseHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  };
}
