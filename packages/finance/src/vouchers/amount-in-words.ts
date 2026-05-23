/**
 * Convert a PKR amount (rupees, may include 2-decimal paisa) to words in
 * English and Urdu using the Indian/Pakistani numbering system
 * (lac, crore). Used on every voucher template.
 */

const EN_ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enUnder100(n: number): string {
  if (n < 20) return EN_ONES[n] ?? '';
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r === 0 ? (EN_TENS[t] ?? '') : `${EN_TENS[t]}-${EN_ONES[r]}`;
}

function enUnder1000(n: number): string {
  if (n < 100) return enUnder100(n);
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const base = `${EN_ONES[h]} hundred`;
  return rem === 0 ? base : `${base} ${enUnder100(rem)}`;
}

function enIntToWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  let rest = n % 10_000_000;
  const lac = Math.floor(rest / 100_000);
  rest = rest % 100_000;
  const thousand = Math.floor(rest / 1000);
  rest = rest % 1000;
  if (crore > 0) parts.push(`${enIntToWords(crore)} crore`);
  if (lac > 0) parts.push(`${enUnder1000(lac)} lac`);
  if (thousand > 0) parts.push(`${enUnder1000(thousand)} thousand`);
  if (rest > 0) parts.push(enUnder1000(rest));
  return parts.join(' ');
}

export function amountInWordsEn(rupees: number): string {
  const negative = rupees < 0;
  const abs = Math.abs(rupees);
  const whole = Math.floor(abs);
  const paisa = Math.round((abs - whole) * 100);
  const w = enIntToWords(whole);
  const cap = w.charAt(0).toUpperCase() + w.slice(1);
  const tail = paisa > 0 ? ` and ${enIntToWords(paisa)} paisa only` : ' rupees only';
  return `${negative ? 'Minus ' : ''}${cap}${paisa > 0 ? ' rupees' : ''}${tail}`;
}

const UR_ONES = [
  '', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو',
  'دس', 'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس',
];
const UR_TENS = ['', '', 'بیس', 'تیس', 'چالیس', 'پچاس', 'ساٹھ', 'ستر', 'اسی', 'نوے'];

function urUnder100(n: number): string {
  if (n < 20) return UR_ONES[n] ?? '';
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r === 0 ? (UR_TENS[t] ?? '') : `${UR_ONES[r]}${UR_TENS[t]}`;
}

function urUnder1000(n: number): string {
  if (n < 100) return urUnder100(n);
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const base = `${UR_ONES[h]} سو`;
  return rem === 0 ? base : `${base} ${urUnder100(rem)}`;
}

function urIntToWords(n: number): string {
  if (n === 0) return 'صفر';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  let rest = n % 10_000_000;
  const lac = Math.floor(rest / 100_000);
  rest = rest % 100_000;
  const thousand = Math.floor(rest / 1000);
  rest = rest % 1000;
  if (crore > 0) parts.push(`${urIntToWords(crore)} کروڑ`);
  if (lac > 0) parts.push(`${urUnder1000(lac)} لاکھ`);
  if (thousand > 0) parts.push(`${urUnder1000(thousand)} ہزار`);
  if (rest > 0) parts.push(urUnder1000(rest));
  return parts.join(' ');
}

export function amountInWordsUr(rupees: number): string {
  const negative = rupees < 0;
  const abs = Math.abs(rupees);
  const whole = Math.floor(abs);
  const paisa = Math.round((abs - whole) * 100);
  const w = urIntToWords(whole);
  const tail = paisa > 0 ? ` روپے اور ${urIntToWords(paisa)} پیسے فقط` : ' روپے فقط';
  return `${negative ? 'منفی ' : ''}${w}${tail}`;
}
