import type { Locale } from '@zameen/locale';

function localeTag(locale: Locale | undefined): string {
  return locale === 'ur' ? 'ur-PK' : 'en-PK';
}

export function fmtDate(d: Date | string | null | undefined, locale?: Locale): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

export function fmtDateTime(d: Date | string | null | undefined, locale?: Locale): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export function fmtNumber(
  n: number | string | null | undefined,
  frac: number = 2,
  locale?: Locale,
  useEasternNumerals: boolean = false,
): string {
  if (n == null) return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '—';
  const tag = locale === 'ur' && useEasternNumerals ? 'ur-PK' : 'en-PK';
  return new Intl.NumberFormat(tag, {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(num);
}

export function parseGeometry(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.type === 'Polygon' || parsed?.type === 'MultiPolygon') return parsed;
  } catch {
    // treat as comma separated lat,lng pairs per line
    const ring: [number, number][] = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [a, b] = l.split(/[,\s]+/).map(Number);
        return [b!, a!] as [number, number];
      });
    if (ring.length >= 3) {
      if (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1]) ring.push(ring[0]!);
      return { type: 'Polygon' as const, coordinates: [ring] };
    }
  }
  return null;
}
