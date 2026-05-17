/**
 * Cross-cutting utilities used everywhere. Enforce kebab-case file names,
 * strip em-dashes (per CLAUDE.md formatting rules), and convert Gregorian
 * to Hijri for any UI that needs both calendars.
 */

const HIJRI_MONTH_UR = [
  'محرم',
  'صفر',
  'ربیع الاول',
  'ربیع الثانی',
  'جمادی الاول',
  'جمادی الثانی',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذوالقعدہ',
  'ذوالحجہ',
];

const HIJRI_MONTH_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
];

export interface HijriDate {
  year: number;
  month: number;
  day: number;
  monthNameEn: string;
  monthNameUr: string;
}

/**
 * Convert a Gregorian Date to Hijri using the Umm al-Qura calendar.
 * Used by reports and forms that surface both calendars to Pakistani users.
 */
export function toHijri(date: Date): HijriDate {
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '0');
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '0');
  return {
    year,
    month,
    day,
    monthNameEn: HIJRI_MONTH_EN[month - 1] ?? '',
    monthNameUr: HIJRI_MONTH_UR[month - 1] ?? '',
  };
}

/**
 * Reject file names that contain underscores. Repo convention is kebab-case
 * only, so any module that accepts a user-provided file name asserts here.
 */
export function assertKebabCase(filename: string): void {
  if (filename.includes('_')) {
    throw new Error(`Filename ${filename} must be kebab-case, not snake_case`);
  }
}

/** Detect em-dash characters in any string. Used by doc-export guard rails. */
export function containsEmDash(text: string): boolean {
  return /[—–]/.test(text);
}

/**
 * Replace em-dashes and en-dashes with comma + space so generated documents
 * stay within the house style without manual review.
 */
export function stripEmDashes(text: string): string {
  return text.replace(/[—–]/g, ', ');
}
