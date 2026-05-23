// mandi-prices-poller
// Schedule: pg_cron Monday 03:00 UTC (08:00 PKT). PBS bulletins land
// Friday/Saturday. We hit pricecheck.gov.pk's JSON endpoint first; on failure
// we surface the empty result so the UI can fall back to manual entry without
// crashing the cron.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const PRICECHECK_URL = 'https://www.pricecheck.gov.pk/api/get_data';
const REQUEST_TIMEOUT_MS = 30_000;

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

function asNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const COMMODITY_NORMALISE: Record<string, string> = {
  wheat: 'wheat',
  'wheat (grain)': 'wheat',
  rice: 'rice',
  basmati: 'rice',
  'rice basmati': 'rice',
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

Deno.serve(
  instrument('mandi-prices-poller', async () => {
    const supabase = getServiceClient();
    let rows: PriceCheckRow[] = [];

    try {
      let res = await fetchWithTimeout(PRICECHECK_URL, { headers: { accept: 'application/json' } });
      if (!res.ok) {
        res = await fetchWithTimeout(PRICECHECK_URL, { headers: { accept: 'application/json' } });
      }
      if (res.ok) {
        const json = (await res.json()) as PriceCheckResponse;
        rows = json.data ?? [];
      }
    } catch (err) {
      console.warn('pricecheck fetch failed; falling back to manual entry', err);
    }

    if (rows.length === 0) {
      return jsonResponse({ inserts: 0, skipped: 0, note: 'scrape failed; manual entry needed' });
    }

    const today = new Date().toISOString().slice(0, 10);
    let inserts = 0;
    let skipped = 0;

    for (const row of rows) {
      const commodity = normaliseCommodity(String(row.commodity_name ?? ''));
      if (!commodity) {
        skipped += 1;
        continue;
      }
      const minPkr = asNumber(row.min_price);
      const maxPkr = asNumber(row.max_price);
      const modePkr = asNumber(row.average_price) || (minPkr + maxPkr) / 2;
      if (modePkr <= 0) {
        skipped += 1;
        continue;
      }
      const recordedOn = String(row.date ?? today).slice(0, 10);
      const market = String(row.city ?? '').trim() || 'unknown';
      const unit = String(row.unit ?? 'kg').toLowerCase().slice(0, 16);

      const { error } = await supabase.from('market_prices').insert({
        commodity,
        market,
        recorded_on: recordedOn,
        unit,
        min_pkr: minPkr,
        max_pkr: maxPkr,
        mode_pkr: modePkr,
        source: 'pbs',
      });
      if (error) {
        if (error.code === '23505') {
          skipped += 1;
        } else {
          console.error('mandi insert failed', error);
        }
        continue;
      }
      inserts += 1;
    }

    return jsonResponse({ inserts, skipped });
  }),
);
