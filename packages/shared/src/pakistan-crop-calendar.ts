// pakistan-crop-calendar
// Curated FAO crop calendar for major Punjab crops. Used to pre-fill planned
// sowing/harvest windows on new crop plans and to flag out-of-window activity
// logs. Static JSON; reviewed manually because FAO updates < 1/year.

import calendarData from './lib/pakistan-crop-calendar.json' with { type: 'json' };

export type CropSeason = 'rabi' | 'kharif';

export interface CropCalendarEntry {
  crop: string;
  season: CropSeason;
  sowingStart: string;
  sowingEnd: string;
  harvestStart: string;
  harvestEnd: string;
  notes: string;
}

interface CalendarFile {
  source: string;
  lastReviewed: string;
  crops: CropCalendarEntry[];
}

const DATA = calendarData as CalendarFile;

export function listCropCalendar(): readonly CropCalendarEntry[] {
  return DATA.crops;
}

export function findCropCalendar(cropKey: string): CropCalendarEntry | undefined {
  const k = cropKey.toLowerCase().trim();
  return DATA.crops.find((c) => c.crop === k || c.crop.startsWith(`${k}-`));
}

function monthDayToDateInYear(monthDay: string, refYear: number): Date {
  const [mm, dd] = monthDay.split('-').map(Number);
  return new Date(Date.UTC(refYear, (mm ?? 1) - 1, dd ?? 1));
}

/**
 * Compute next sowing window for the given crop relative to a reference date.
 * Returns null if crop unknown. Window may roll into next year for crops whose
 * sowing window has already closed for the current year.
 */
export function nextSowingWindow(
  cropKey: string,
  reference: Date = new Date(),
): { start: Date; end: Date } | null {
  const c = findCropCalendar(cropKey);
  if (!c) return null;
  const year = reference.getUTCFullYear();
  let start = monthDayToDateInYear(c.sowingStart, year);
  let end = monthDayToDateInYear(c.sowingEnd, year);
  if (end.getTime() < reference.getTime()) {
    start = monthDayToDateInYear(c.sowingStart, year + 1);
    end = monthDayToDateInYear(c.sowingEnd, year + 1);
  }
  return { start, end };
}

/**
 * Verify a sowing date falls inside the canonical window. If not, return an
 * explanatory message in English plus Urdu for surfacing to field workers.
 */
export function checkSowingDate(
  cropKey: string,
  sowingIso: string,
): { ok: boolean; warning?: string; warningUr?: string } {
  const c = findCropCalendar(cropKey);
  if (!c) return { ok: true };
  const md = sowingIso.slice(5);
  const inWindow = monthDayInRange(md, c.sowingStart, c.sowingEnd);
  if (inWindow) return { ok: true };
  return {
    ok: false,
    warning: `${cropKey} sowing on ${sowingIso} is outside FAO canonical window (${c.sowingStart} to ${c.sowingEnd}). Confirm.`,
    warningUr: `${cropKey} کی بوائی ${sowingIso} کو معمول کے وقت سے باہر ہے۔ تصدیق کریں۔`,
  };
}

function monthDayInRange(target: string, start: string, end: string): boolean {
  // start may be after end across year boundary (e.g. sugarcane 11-01 to 03-31).
  if (start <= end) return target >= start && target <= end;
  return target >= start || target <= end;
}
