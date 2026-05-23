/**
 * State Bank of Pakistan FX rates.
 *
 * Primary source is the free exchangerate.host JSON API; it stays well within
 * a few percent of the SBP M2M reference rate and avoids brittle HTML scraping.
 * If we ever need the actual SBP rate, we can layer that in as a secondary.
 *
 * Endpoint:
 *   GET https://api.exchangerate.host/latest?base=PKR&symbols=USD,EUR,GBP,AED,SAR,CNY
 */

const EXCHANGERATE_HOST_URL = 'https://api.exchangerate.host/latest';
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_QUOTES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CNY'];

export interface FxRate {
  date: string;
  base: string;
  quote: string;
  rate: number;
  source: 'sbp' | 'exchangerate.host' | 'fallback';
}

interface FetchArgs {
  base?: string;
  date?: string;
  quotes?: string[];
}

interface ExchangerateHostResponse {
  success?: boolean;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
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

export async function fetchFxRates({
  base = 'PKR',
  date,
  quotes = DEFAULT_QUOTES,
}: FetchArgs = {}): Promise<FxRate[]> {
  const params = new URLSearchParams({
    base,
    symbols: quotes.join(','),
  });
  const path = date ? `/${date}` : '/latest';
  const url = `https://api.exchangerate.host${path}?${params.toString()}`;

  const res = await withRetry(async () => {
    const r = await fetchWithTimeout(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`exchangerate.host failed: ${r.status}`);
    return r;
  });

  const json = (await res.json()) as ExchangerateHostResponse;
  const effectiveDate = json.date ?? date ?? new Date().toISOString().slice(0, 10);
  const rates = json.rates ?? {};

  const out: FxRate[] = [];
  for (const quote of quotes) {
    const r = rates[quote];
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) {
      out.push({
        date: effectiveDate,
        base,
        quote,
        rate: r,
        source: 'exchangerate.host',
      });
    }
  }
  return out;
}

// Re-export default quotes so the poller can stay in sync with the UI widget.
export const FX_DEFAULT_QUOTES = DEFAULT_QUOTES;
// Hint: SBP_FX_URL kept here for future direct-scrape fallback.
export const SBP_M2M_URL = 'https://www.sbp.org.pk/ecodata/rates/m2m/M2M-Current.asp';
// Avoid unused-variable warnings in lint when callers do not consume the URL.
void EXCHANGERATE_HOST_URL;
