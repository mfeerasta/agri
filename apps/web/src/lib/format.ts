export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtNumber(n: number | string | null | undefined, frac = 2): string {
  if (n == null) return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: frac, maximumFractionDigits: frac }).format(num);
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
