// pk-holidays
// Pakistan public + religious holiday lookup. Combines Nager.Date (gazetted
// public holidays) with Aladhan (Hijri calendar + Eid/Ramadan windows) and a
// static supplement for Pakistan-specific observances missing from Nager.
// Free, keyless. 30s timeout + single retry per upstream.

const NAGER_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const ALADHAN_HIJRI_CAL = 'https://api.aladhan.com/v1/gToHCalendarByCity';
const REQUEST_TIMEOUT_MS = 30_000;

export interface HolidayEntry {
  date: string;
  hijriDate?: string;
  name: string;
  nameUr?: string;
  kind: 'public' | 'religious' | 'observance';
  fixed: boolean;
}

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  fixed: boolean;
  global: boolean;
  types: string[];
}

interface AladhanCalendarDay {
  date: {
    readable: string;
    timestamp: string;
    gregorian: { date: string };
    hijri: {
      date: string;
      month: { number: number; en: string };
      day: string;
      year: string;
      holidays: string[];
    };
  };
}

interface PkStaticHoliday {
  monthDay: string;
  name: string;
  nameUr: string;
  kind: HolidayEntry['kind'];
}

const PK_STATIC_HOLIDAYS: readonly PkStaticHoliday[] = [
  { monthDay: '02-05', name: 'Kashmir Solidarity Day', nameUr: 'یوم یکجہتی کشمیر', kind: 'public' },
  { monthDay: '03-23', name: 'Pakistan Day', nameUr: 'یوم پاکستان', kind: 'public' },
  { monthDay: '05-01', name: 'Labour Day', nameUr: 'یوم مزدور', kind: 'public' },
  { monthDay: '08-14', name: 'Independence Day', nameUr: 'یوم آزادی', kind: 'public' },
  { monthDay: '09-06', name: 'Defence Day', nameUr: 'یوم دفاع', kind: 'observance' },
  { monthDay: '09-11', name: 'Death anniversary of Quaid-e-Azam', nameUr: 'یوم وفات قائد اعظم', kind: 'observance' },
  { monthDay: '11-09', name: 'Iqbal Day', nameUr: 'یوم اقبال', kind: 'observance' },
  { monthDay: '12-25', name: 'Quaid-e-Azam Day', nameUr: 'یوم پیدائش قائد اعظم', kind: 'public' },
];

const ISLAMIC_NAME_UR: Record<string, string> = {
  'Eid-ul-Fitr': 'عید الفطر',
  'Eid ul-Fitr': 'عید الفطر',
  'Eid al-Fitr': 'عید الفطر',
  'Eid-ul-Adha': 'عید الاضحی',
  'Eid ul-Adha': 'عید الاضحی',
  'Eid al-Adha': 'عید الاضحی',
  'Ashura': 'یوم عاشورہ',
  'Day of Ashura': 'یوم عاشورہ',
  "Mawlid al-Nabi": 'عید میلاد النبی',
  'Eid Milad-un-Nabi': 'عید میلاد النبی',
  'Ramadan': 'رمضان',
  'Laylat al-Qadr': 'لیلۃ القدر',
  'Lailat al-Bara': 'شب برات',
};

async function fetchWithTimeout(url: string, attempt = 0): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok && attempt === 0) {
      clearTimeout(t);
      return fetchWithTimeout(url, 1);
    }
    return res;
  } catch (err) {
    if (attempt === 0) return fetchWithTimeout(url, 1);
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function fetchNager(year: number): Promise<HolidayEntry[]> {
  try {
    const res = await fetchWithTimeout(`${NAGER_URL}/${year}/PK`);
    if (!res.ok) return [];
    const rows = (await res.json()) as NagerHoliday[];
    return rows.map((r) => ({
      date: r.date,
      name: r.name,
      kind: 'public' as const,
      fixed: r.fixed,
    }));
  } catch {
    return [];
  }
}

async function fetchAladhanMonth(month: number, year: number): Promise<AladhanCalendarDay[]> {
  const url = `${ALADHAN_HIJRI_CAL}/${month}/${year}?city=Lahore&country=Pakistan`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: AladhanCalendarDay[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

function parseAladhanGregorian(d: string): string {
  // Aladhan returns DD-MM-YYYY in gregorian.date
  const [dd, mm, yyyy] = d.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchAladhan(year: number): Promise<HolidayEntry[]> {
  const months = await Promise.all(
    Array.from({ length: 12 }, (_, i) => fetchAladhanMonth(i + 1, year)),
  );
  const out: HolidayEntry[] = [];
  for (const month of months) {
    for (const day of month) {
      const holidays = day.date.hijri.holidays ?? [];
      if (holidays.length === 0) continue;
      const greg = parseAladhanGregorian(day.date.gregorian.date);
      const hijriDate = `${day.date.hijri.day} ${day.date.hijri.month.en} ${day.date.hijri.year}`;
      for (const h of holidays) {
        out.push({
          date: greg,
          hijriDate,
          name: h,
          nameUr: ISLAMIC_NAME_UR[h],
          kind: 'religious',
          fixed: false,
        });
      }
    }
  }
  return out;
}

function staticForYear(year: number): HolidayEntry[] {
  return PK_STATIC_HOLIDAYS.map((h) => ({
    date: `${year}-${h.monthDay}`,
    name: h.name,
    nameUr: h.nameUr,
    kind: h.kind,
    fixed: true,
  }));
}

function dedupe(rows: HolidayEntry[]): HolidayEntry[] {
  const seen = new Set<string>();
  const out: HolidayEntry[] = [];
  for (const r of rows) {
    const key = `${r.date}|${r.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function fetchHolidays(year: number): Promise<HolidayEntry[]> {
  const [nager, aladhan] = await Promise.all([fetchNager(year), fetchAladhan(year)]);
  const merged = [...nager, ...aladhan, ...staticForYear(year)];
  // Fill Urdu for Nager entries that match islamic key names by best-effort
  for (const m of merged) {
    if (!m.nameUr && ISLAMIC_NAME_UR[m.name]) m.nameUr = ISLAMIC_NAME_UR[m.name];
  }
  return dedupe(merged).sort((a, b) => a.date.localeCompare(b.date));
}

function matchEvent(rows: HolidayEntry[], needle: string): HolidayEntry[] {
  const n = needle.toLowerCase();
  return rows.filter((r) => r.name.toLowerCase().includes(n));
}

export async function fetchRamadanWindow(
  year: number,
): Promise<{ start: string; end: string } | null> {
  // Pull whole-year Aladhan and find first/last day where hijri month is Ramadan (9).
  const months = await Promise.all(
    Array.from({ length: 12 }, (_, i) => fetchAladhanMonth(i + 1, year)),
  );
  const ramadanDays: string[] = [];
  for (const month of months) {
    for (const day of month) {
      if (day.date.hijri.month.number === 9) {
        ramadanDays.push(parseAladhanGregorian(day.date.gregorian.date));
      }
    }
  }
  if (ramadanDays.length === 0) return null;
  ramadanDays.sort();
  return { start: ramadanDays[0]!, end: ramadanDays[ramadanDays.length - 1]! };
}

export async function fetchEidWindows(
  year: number,
): Promise<Array<{ eid: 'al-fitr' | 'al-adha'; start: string; end: string }>> {
  const rows = await fetchAladhan(year);
  const out: Array<{ eid: 'al-fitr' | 'al-adha'; start: string; end: string }> = [];
  const fitr = matchEvent(rows, 'fitr').map((r) => r.date).sort();
  const adha = matchEvent(rows, 'adha').map((r) => r.date).sort();
  if (fitr.length > 0) out.push({ eid: 'al-fitr', start: fitr[0]!, end: fitr[fitr.length - 1]! });
  if (adha.length > 0) out.push({ eid: 'al-adha', start: adha[0]!, end: adha[adha.length - 1]! });
  return out;
}
