// ramadan-server
// Aladhan-backed helpers for the field PWA server layout. In-process 6h cache.

const ALADHAN_TIMINGS = 'https://api.aladhan.com/v1/timingsByCity';
const REQUEST_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface TimingsBody {
  data?: {
    timings: Record<string, string>;
    date: { hijri: { day: string; month: { number: number } } };
  };
}

interface CachedTimings {
  fetchedAt: number;
  iftarLocal: string;
  hijriDay: number;
  hijriMonth: number;
}

const cache = new Map<string, CachedTimings>();

function pktDateKey(date: Date): string {
  const pkt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return pkt.toISOString().slice(0, 10);
}

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

async function getTimings(date: Date): Promise<CachedTimings | null> {
  const key = pktDateKey(date);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  const [yyyy, mm, dd] = key.split('-');
  const url = `${ALADHAN_TIMINGS}/${dd}-${mm}-${yyyy}?city=Lahore&country=Pakistan`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const body = (await res.json()) as TimingsBody;
    if (!body.data) return null;
    const entry: CachedTimings = {
      fetchedAt: Date.now(),
      iftarLocal: body.data.timings.Maghrib ?? '',
      hijriDay: Number(body.data.date.hijri.day),
      hijriMonth: body.data.date.hijri.month.number,
    };
    cache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

export async function getCurrentRamadanDay(): Promise<number | null> {
  const t = await getTimings(new Date());
  if (!t || t.hijriMonth !== 9) return null;
  return t.hijriDay;
}

export async function getIftarTime(date: Date = new Date()): Promise<Date | null> {
  const t = await getTimings(date);
  if (!t || !t.iftarLocal) return null;
  const match = /^(\d{2}):(\d{2})/.exec(t.iftarLocal);
  if (!match) return null;
  const key = pktDateKey(date);
  return new Date(`${key}T${match[1]}:${match[2]}:00+05:00`);
}
