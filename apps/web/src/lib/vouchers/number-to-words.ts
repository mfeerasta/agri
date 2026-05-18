// PKR amount-in-words helpers (Indian numbering: lakh + crore).
// Capped at 99 crore (9_999_999_999) for sanity. Supports English and Urdu.

const ONES_EN = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS_EN = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const ONES_UR = [
  '',
  'ایک',
  'دو',
  'تین',
  'چار',
  'پانچ',
  'چھ',
  'سات',
  'آٹھ',
  'نو',
  'دس',
  'گیارہ',
  'بارہ',
  'تیرہ',
  'چودہ',
  'پندرہ',
  'سولہ',
  'سترہ',
  'اٹھارہ',
  'انیس',
];

// 20..99 Urdu mapping (irregular).
const URDU_TENS: Record<number, string> = {
  20: 'بیس',
  30: 'تیس',
  40: 'چالیس',
  50: 'پچاس',
  60: 'ساٹھ',
  70: 'ستر',
  80: 'اسی',
  90: 'نوے',
};

function urduUnderHundred(n: number): string {
  if (n < 20) return ONES_UR[n] ?? '';
  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;
  if (ones === 0) return URDU_TENS[tens] ?? '';
  // For 21..99 we render as 'ones-and-tens', kept simple: "ones + tens".
  return `${ONES_UR[ones]} ${URDU_TENS[tens] ?? ''}`.trim();
}

function enUnderHundred(n: number): string {
  if (n < 20) return ONES_EN[n] ?? '';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return TENS_EN[tens] ?? '';
  return `${TENS_EN[tens]}-${ONES_EN[ones]}`;
}

function enUnderThousand(n: number): string {
  if (n < 100) return enUnderHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${ONES_EN[hundreds]} Hundred`;
  return rest === 0 ? head : `${head} ${enUnderHundred(rest)}`;
}

function urduUnderThousand(n: number): string {
  if (n < 100) return urduUnderHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${ONES_UR[hundreds]} سو`;
  return rest === 0 ? head : `${head} ${urduUnderHundred(rest)}`;
}

function integerToEnglishWords(num: number): string {
  if (num === 0) return 'Zero';
  if (num < 0) return `Minus ${integerToEnglishWords(-num)}`;
  const crore = Math.floor(num / 10_000_000);
  const afterCrore = num % 10_000_000;
  const lakh = Math.floor(afterCrore / 100_000);
  const afterLakh = afterCrore % 100_000;
  const thousand = Math.floor(afterLakh / 1000);
  const afterThousand = afterLakh % 1000;
  const parts: string[] = [];
  if (crore > 0) parts.push(`${integerToEnglishWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${enUnderHundred(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${enUnderThousand(thousand)} Thousand`);
  if (afterThousand > 0) parts.push(enUnderThousand(afterThousand));
  return parts.join(' ');
}

function integerToUrduWords(num: number): string {
  if (num === 0) return 'صفر';
  if (num < 0) return `منفی ${integerToUrduWords(-num)}`;
  const crore = Math.floor(num / 10_000_000);
  const afterCrore = num % 10_000_000;
  const lakh = Math.floor(afterCrore / 100_000);
  const afterLakh = afterCrore % 100_000;
  const thousand = Math.floor(afterLakh / 1000);
  const afterThousand = afterLakh % 1000;
  const parts: string[] = [];
  if (crore > 0) parts.push(`${integerToUrduWords(crore)} کروڑ`);
  if (lakh > 0) parts.push(`${urduUnderHundred(lakh)} لاکھ`);
  if (thousand > 0) parts.push(`${urduUnderThousand(thousand)} ہزار`);
  if (afterThousand > 0) parts.push(urduUnderThousand(afterThousand));
  return parts.join(' ');
}

/**
 * Convert a PKR amount to words. Caps at 99 crore (9_999_999_999.99).
 * Paisa = decimal portion rounded to 2 places.
 */
export function pkrToWords(amount: number | string, locale: 'en' | 'ur'): string {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(num)) return '';
  const capped = Math.min(Math.max(num, -9_999_999_999.99), 9_999_999_999.99);
  const isNeg = capped < 0;
  const abs = Math.abs(capped);
  const rupees = Math.floor(abs);
  const paisa = Math.round((abs - rupees) * 100);
  if (locale === 'ur') {
    const rWord = integerToUrduWords(rupees);
    const head = `${rWord} روپے`;
    const tail = paisa > 0 ? ` اور ${integerToUrduWords(paisa)} پیسے` : '';
    const sign = isNeg ? 'منفی ' : '';
    return `${sign}${head}${tail} فقط`;
  }
  const rWord = integerToEnglishWords(rupees);
  const head = `Rupees ${rWord}`;
  const tail = paisa > 0 ? ` and ${integerToEnglishWords(paisa)} Paisa` : '';
  const sign = isNeg ? 'Minus ' : '';
  return `${sign}${head}${tail} Only`;
}
