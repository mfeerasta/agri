/**
 * PKR money handling. Platform is PKR-only.
 *
 * Internally we store paisa (smallest unit) as bigint to avoid float drift,
 * but DB columns use decimal(.., 2) so this module also exposes string<->bigint
 * conversion helpers.
 */

export type PKR = bigint;

const PAISA_PER_RUPEE = 100n;

export function fromRupees(rupees: number | string): PKR {
  const s = typeof rupees === 'number' ? rupees.toString() : rupees.trim();
  if (!s) return 0n;
  const [whole, fracRaw] = s.replace(/,/g, '').split('.');
  const frac = (fracRaw ?? '').padEnd(2, '0').slice(0, 2);
  const sign = whole?.startsWith('-') ? -1n : 1n;
  const wholeAbs = (whole ?? '0').replace('-', '');
  return sign * (BigInt(wholeAbs) * PAISA_PER_RUPEE + BigInt(frac || '0'));
}

export function toRupeesNumber(paisa: PKR): number {
  return Number(paisa) / 100;
}

export function toRupeesString(paisa: PKR): string {
  const negative = paisa < 0n;
  const abs = negative ? -paisa : paisa;
  const rupees = abs / PAISA_PER_RUPEE;
  const remainder = abs % PAISA_PER_RUPEE;
  const fracStr = remainder.toString().padStart(2, '0');
  return `${negative ? '-' : ''}${rupees.toString()}.${fracStr}`;
}

export function add(...xs: PKR[]): PKR {
  return xs.reduce<PKR>((a, b) => a + b, 0n);
}

export function sub(a: PKR, b: PKR): PKR {
  return a - b;
}

export function mul(amount: PKR, factor: number): PKR {
  const factorScaled = BigInt(Math.round(factor * 1_000_000));
  return (amount * factorScaled) / 1_000_000n;
}

export type DisplayMode = 'plain' | 'lac_crore';

export function formatPkr(paisa: PKR, mode: DisplayMode = 'plain', locale: 'en' | 'ur' = 'en'): string {
  const rupees = toRupeesNumber(paisa);
  if (mode === 'lac_crore') {
    const abs = Math.abs(rupees);
    if (abs >= 10_000_000) {
      return `${rupees < 0 ? '-' : ''}Rs. ${(abs / 10_000_000).toFixed(2)} crore`;
    }
    if (abs >= 100_000) {
      return `${rupees < 0 ? '-' : ''}Rs. ${(abs / 100_000).toFixed(2)} lac`;
    }
  }
  const formatted = new Intl.NumberFormat(locale === 'ur' ? 'ur-PK' : 'en-PK', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
  return `Rs. ${formatted}`;
}
