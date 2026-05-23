/**
 * Pakistan Bureau of Statistics / pricecheck.gov.pk wholesale prices.
 *
 * PBS publishes weekly bulletins (typically Friday/Saturday) at
 *   https://www.pbs.gov.pk/sites/default/files/weekly_consumer_pricing
 * The format is irregular HTML/Excel. We do a best-effort scrape and fall
 * back to a manual-entry workflow when the layout shifts.
 *
 * Output is normalised to the existing zameen.market_prices table.
 */

const PBS_INDEX_URL = 'https://www.pbs.gov.pk/sites/default/files/weekly_consumer_pricing';
const PRICECHECK_URL = 'https://www.pricecheck.gov.pk/api/get_data';
const REQUEST_TIMEOUT_MS = 30_000;

export interface MandiPrice {
  commodity: string;
  market: string;
  district: string;
  recordedOn: string;
  unit: string;
  minPkr: number;
  maxPkr: number;
  modePkr: number;
  source: 'pbs' | 'punjab-agri' | 'manual';
}

interface PriceCheckRow {
  commodity_name?: string;
  city?: string;
  district?: string;
  date?: string;
  unit?: string;
  min_price?: number | string;
  max_price?: number | string;
  average_price?: number | string;
}

interface PriceCheckResponse {
  data?: PriceCheckRow[];
}

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

function asNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const COMMODITY_NORMALISE: Record<string, string> = {
  wheat: 'wheat',
  'wheat (grain)': 'wheat',
  rice: 'rice',
  'rice basmati': 'rice',
  basmati: 'rice',
  cotton: 'cotton',
  'cotton seed': 'cotton',
  maize: 'maize',
  corn: 'maize',
  sugarcane: 'sugarcane',
  potato: 'potato',
  potatoes: 'potato',
  onion: 'onion',
  onions: 'onion',
  tomato: 'tomato',
  tomatoes: 'tomato',
};

function normaliseCommodity(raw: string): string {
  const key = raw.toLowerCase().trim();
  return COMMODITY_NORMALISE[key] ?? key.replace(/\s+/g, '-');
}

/**
 * Tries pricecheck.gov.pk's JSON endpoint first (more reliable than PBS HTML).
 * Returns an empty array on any failure so callers can surface a manual-entry
 * prompt instead of crashing the cron.
 */
export async function fetchLatestMandiPrices(commodities?: string[]): Promise<MandiPrice[]> {
  try {
    const res = await withRetry(async () => {
      const r = await fetchWithTimeout(PRICECHECK_URL, {
        headers: { accept: 'application/json' },
      });
      if (!r.ok) throw new Error(`pricecheck failed: ${r.status}`);
      return r;
    });
    const json = (await res.json()) as PriceCheckResponse;
    const rows = json.data ?? [];
    const wanted = commodities?.map((c) => c.toLowerCase()) ?? null;
    const today = new Date().toISOString().slice(0, 10);

    const out: MandiPrice[] = [];
    for (const r of rows) {
      const commodity = normaliseCommodity(String(r.commodity_name ?? ''));
      if (!commodity) continue;
      if (wanted && !wanted.includes(commodity)) continue;
      const min = asNumber(r.min_price);
      const max = asNumber(r.max_price);
      const mode = asNumber(r.average_price) || (min + max) / 2;
      if (mode <= 0) continue;
      out.push({
        commodity,
        market: String(r.city ?? '').trim() || 'unknown',
        district: String(r.district ?? '').trim() || 'unknown',
        recordedOn: String(r.date ?? today).slice(0, 10),
        unit: String(r.unit ?? 'kg').toLowerCase().slice(0, 16),
        minPkr: min,
        maxPkr: max,
        modePkr: mode,
        source: 'pbs',
      });
    }
    return out;
  } catch {
    return [];
  }
}

export const PBS_DOCUMENTED_FALLBACK = PBS_INDEX_URL;
