// holidays-sync
// Schedule: pg_cron annually on 1 Jan (0 0 1 1 *). Refreshes the Pakistan
// holiday cache for current + next year by combining Nager and Aladhan and
// a small static supplement. Manual invocation works any time of year.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const NAGER_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const ALADHAN_HIJRI_CAL = 'https://api.aladhan.com/v1/gToHCalendarByCity';
const REQUEST_TIMEOUT_MS = 30_000;

interface NagerRow {
  date: string;
  name: string;
  fixed: boolean;
}

interface AladhanDay {
  date: {
    gregorian: { date: string };
    hijri: {
      date: string;
      day: string;
      year: string;
      month: { number: number; en: string };
      holidays: string[];
    };
  };
}

interface HolidayRow {
  date: string;
  hijri_date: string | null;
  name: string;
  name_ur: string | null;
  kind: 'public' | 'religious' | 'observance';
  fixed: boolean;
  source: string;
}

const PK_STATIC: ReadonlyArray<{ monthDay: string; name: string; nameUr: string; kind: HolidayRow['kind'] }> = [
  { monthDay: '02-05', name: 'Kashmir Solidarity Day', nameUr: 'یوم یکجہتی کشمیر', kind: 'public' },
  { monthDay: '03-23', name: 'Pakistan Day', nameUr: 'یوم پاکستان', kind: 'public' },
  { monthDay: '05-01', name: 'Labour Day', nameUr: 'یوم مزدور', kind: 'public' },
  { monthDay: '08-14', name: 'Independence Day', nameUr: 'یوم آزادی', kind: 'public' },
  { monthDay: '09-06', name: 'Defence Day', nameUr: 'یوم دفاع', kind: 'observance' },
  { monthDay: '09-11', name: 'Death anniversary of Quaid-e-Azam', nameUr: 'یوم وفات قائد اعظم', kind: 'observance' },
  { monthDay: '11-09', name: 'Iqbal Day', nameUr: 'یوم اقبال', kind: 'observance' },
  { monthDay: '12-25', name: 'Quaid-e-Azam Day', nameUr: 'یوم پیدائش قائد اعظم', kind: 'public' },
];

const NAME_UR: Record<string, string> = {
  'Eid-ul-Fitr': 'عید الفطر',
  'Eid al-Fitr': 'عید الفطر',
  'Eid ul-Fitr': 'عید الفطر',
  'Eid-ul-Adha': 'عید الاضحی',
  'Eid al-Adha': 'عید الاضحی',
  'Ashura': 'یوم عاشورہ',
  'Day of Ashura': 'یوم عاشورہ',
  'Mawlid al-Nabi': 'عید میلاد النبی',
  'Eid Milad-un-Nabi': 'عید میلاد النبی',
  'Lailat al-Bara': 'شب برات',
  'Laylat al-Qadr': 'لیلۃ القدر',
};

async function fetchWithTimeout(url: string, attempt = 0): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
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

function parseGreg(d: string): string {
  const [dd, mm, yyyy] = d.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

async function nagerFor(year: number): Promise<HolidayRow[]> {
  try {
    const res = await fetchWithTimeout(`${NAGER_URL}/${year}/PK`);
    if (!res.ok) return [];
    const rows = (await res.json()) as NagerRow[];
    return rows.map((r) => ({
      date: r.date,
      hijri_date: null,
      name: r.name,
      name_ur: NAME_UR[r.name] ?? null,
      kind: 'public',
      fixed: r.fixed,
      source: 'nager',
    }));
  } catch {
    return [];
  }
}

async function aladhanFor(year: number): Promise<HolidayRow[]> {
  const out: HolidayRow[] = [];
  for (let m = 1; m <= 12; m++) {
    try {
      const res = await fetchWithTimeout(
        `${ALADHAN_HIJRI_CAL}/${m}/${year}?city=Lahore&country=Pakistan`,
      );
      if (!res.ok) continue;
      const body = (await res.json()) as { data?: AladhanDay[] };
      for (const day of body.data ?? []) {
        const holidays = day.date.hijri.holidays ?? [];
        if (holidays.length === 0) continue;
        const greg = parseGreg(day.date.gregorian.date);
        const hijri = `${day.date.hijri.day} ${day.date.hijri.month.en} ${day.date.hijri.year}`;
        for (const h of holidays) {
          out.push({
            date: greg,
            hijri_date: hijri,
            name: h,
            name_ur: NAME_UR[h] ?? null,
            kind: 'religious',
            fixed: false,
            source: 'aladhan',
          });
        }
      }
    } catch {
      // continue to next month
    }
  }
  return out;
}

function staticFor(year: number): HolidayRow[] {
  return PK_STATIC.map((h) => ({
    date: `${year}-${h.monthDay}`,
    hijri_date: null,
    name: h.name,
    name_ur: h.nameUr,
    kind: h.kind,
    fixed: true,
    source: 'static',
  }));
}

async function run(years: number[]): Promise<{ processed: number }> {
  const supabase = getServiceClient();
  const all: HolidayRow[] = [];
  for (const y of years) {
    const [n, a, s] = await Promise.all([nagerFor(y), aladhanFor(y), Promise.resolve(staticFor(y))]);
    all.push(...n, ...a, ...s);
  }
  // dedupe by (date, name)
  const seen = new Set<string>();
  const unique = all.filter((r) => {
    const k = `${r.date}|${r.name.toLowerCase().trim()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) return { processed: 0 };
  const { error } = await supabase.from('holidays').upsert(unique, { onConflict: 'date,name' });
  if (error) throw new Error(error.message);
  return { processed: unique.length };
}

Deno.serve(
  instrument('holidays-sync', async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year');
    const now = new Date();
    const years = yearParam
      ? [Number(yearParam)]
      : [now.getUTCFullYear(), now.getUTCFullYear() + 1];
    const result = await run(years);
    return jsonResponse({ ok: true, ...result });
  }),
);
