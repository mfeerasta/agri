// fx-poller
// Schedule: pg_cron daily 04:00 UTC (09:00 PKT). Pulls PKR cross-rates for the
// six currencies Rupafab actually uses and upserts into zameen.fx_rates.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const EXCHANGERATE_HOST = 'https://api.exchangerate.host';
const REQUEST_TIMEOUT_MS = 30_000;
const BASE = 'PKR';
const QUOTES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CNY'];

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

interface ExchangerateHostResponse {
  date?: string;
  base?: string;
  rates?: Record<string, number>;
}

Deno.serve(
  instrument('fx-poller', async () => {
    const supabase = getServiceClient();
    const url = `${EXCHANGERATE_HOST}/latest?base=${BASE}&symbols=${QUOTES.join(',')}`;

    let res: Response;
    try {
      res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`fx ${res.status}`);
    } catch {
      res = await fetchWithTimeout(url);
      if (!res.ok) return jsonResponse({ error: 'fx fetch failed', inserts: 0 }, 502);
    }

    const json = (await res.json()) as ExchangerateHostResponse;
    const today = json.date ?? new Date().toISOString().slice(0, 10);
    const rates = json.rates ?? {};
    let inserts = 0;
    let skipped = 0;

    for (const quote of QUOTES) {
      const rate = rates[quote];
      if (!Number.isFinite(rate) || rate <= 0) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase.from('fx_rates').insert({
        date: today,
        base_currency: BASE,
        quote_currency: quote,
        rate,
        source: 'exchangerate.host',
      });
      if (error) {
        if (error.code === '23505') {
          skipped += 1;
        } else {
          console.error('fx insert failed', error);
        }
        continue;
      }
      inserts += 1;
    }

    return jsonResponse({ inserts, skipped, date: today });
  }),
);
