/**
 * Urdu (Nastaliq) <-> Roman Urdu transliteration.
 *
 * SMS to basic feature phones is 7-bit GSM only; Urdu Nastaliq forces UCS-2
 * encoding which halves the per-segment payload to 70 chars. For workers on
 * basic phones we transliterate to Roman Urdu so each segment carries 160
 * characters.
 *
 * The mapping is intentionally simple. It is good enough for procedural
 * notifications ("Diesel 50L manzoor ho gayi") but not for literary text.
 * Common phrases hit the translation cache so we don't re-run the lookup
 * loop on every dispatch.
 */

// Single-character map. Order matters only for vowels where we do a
// context-aware pass after the main substitution.
const UR_TO_ROMAN_BASE: Array<[string, string]> = [
  // Digraphs / aspirated consonants first so they match before single chars
  ['بھ', 'bh'],
  ['پھ', 'ph'],
  ['تھ', 'th'],
  ['ٹھ', 'th'],
  ['جھ', 'jh'],
  ['چھ', 'ch'],
  ['دھ', 'dh'],
  ['ڈھ', 'dh'],
  ['کھ', 'kh'],
  ['گھ', 'gh'],
  // Consonants
  ['ا', 'a'],
  ['آ', 'aa'],
  ['ب', 'b'],
  ['پ', 'p'],
  ['ت', 't'],
  ['ٹ', 't'],
  ['ث', 's'],
  ['ج', 'j'],
  ['چ', 'ch'],
  ['ح', 'h'],
  ['خ', 'kh'],
  ['د', 'd'],
  ['ڈ', 'd'],
  ['ذ', 'z'],
  ['ر', 'r'],
  ['ڑ', 'r'],
  ['ز', 'z'],
  ['ژ', 'zh'],
  ['س', 's'],
  ['ش', 'sh'],
  ['ص', 's'],
  ['ض', 'z'],
  ['ط', 't'],
  ['ظ', 'z'],
  ['ع', 'a'],
  ['غ', 'gh'],
  ['ف', 'f'],
  ['ق', 'q'],
  ['ک', 'k'],
  ['گ', 'g'],
  ['ل', 'l'],
  ['م', 'm'],
  ['ن', 'n'],
  ['ں', 'n'],
  ['و', 'o'],
  ['ہ', 'h'],
  ['ھ', 'h'],
  ['ء', ''],
  ['ی', 'i'],
  ['ے', 'e'],
  ['ئ', 'i'],
  ['ؤ', 'o'],
  ['أ', 'a'],
  // Diacritics drop
  ['ُ', 'u'],
  ['ِ', 'i'],
  ['َ', 'a'],
  ['ّ', ''],
  ['ْ', ''],
  ['ٔ', ''],
  // Punctuation
  ['۔', '.'],
  ['،', ','],
  ['؟', '?'],
  ['؛', ';'],
  // Urdu numerals
  ['۰', '0'],
  ['۱', '1'],
  ['۲', '2'],
  ['۳', '3'],
  ['۴', '4'],
  ['۵', '5'],
  ['۶', '6'],
  ['۷', '7'],
  ['۸', '8'],
  ['۹', '9'],
];

const ROMAN_TO_UR_BASE: Array<[string, string]> = [
  // Multi-letter first
  ['aa', 'آ'],
  ['ch', 'چ'],
  ['sh', 'ش'],
  ['kh', 'خ'],
  ['gh', 'غ'],
  ['zh', 'ژ'],
  ['bh', 'بھ'],
  ['ph', 'پھ'],
  ['th', 'تھ'],
  ['jh', 'جھ'],
  ['dh', 'دھ'],
  // Singles
  ['a', 'ا'],
  ['b', 'ب'],
  ['p', 'پ'],
  ['t', 'ت'],
  ['j', 'ج'],
  ['h', 'ہ'],
  ['d', 'د'],
  ['r', 'ر'],
  ['z', 'ز'],
  ['s', 'س'],
  ['f', 'ف'],
  ['q', 'ق'],
  ['k', 'ک'],
  ['g', 'گ'],
  ['l', 'ل'],
  ['m', 'م'],
  ['n', 'ن'],
  ['o', 'و'],
  ['u', 'و'],
  ['i', 'ی'],
  ['e', 'ے'],
  ['v', 'و'],
  ['w', 'و'],
  ['y', 'ی'],
];

const COMMON_PHRASE_OVERRIDES: Record<string, string> = {
  'منظور': 'manzoor',
  'مسترد': 'mustarid',
  'منظوری': 'manzoori',
  'لیٹر': 'liter',
  'روپے': 'rupay',
  'فارم': 'farm',
  'ڈیزل': 'diesel',
  'مرمت': 'marammat',
  'حاضری': 'hazri',
  'چھٹی': 'chuti',
  'فصل': 'fasal',
  'پانی': 'pani',
  'کھاد': 'khaad',
  'بیج': 'beej',
  'دوا': 'dawa',
  'سپرے': 'spray',
  'ٹریکٹر': 'tractor',
  'مزدور': 'mazdoor',
};

/**
 * Convert Urdu Nastaliq text to Roman Urdu (best-effort).
 * Common bag-of-words tokens are swapped first, then the residual is
 * char-mapped. Whitespace and ASCII passes through untouched.
 */
export function urduToRoman(text: string): string {
  if (!text) return '';
  let out = text;
  for (const [phrase, roman] of Object.entries(COMMON_PHRASE_OVERRIDES)) {
    if (out.includes(phrase)) {
      out = out.split(phrase).join(roman);
    }
  }
  for (const [src, dst] of UR_TO_ROMAN_BASE) {
    if (out.includes(src)) out = out.split(src).join(dst);
  }
  // Collapse repeated vowels created by char-by-char swap.
  out = out.replace(/aaa+/g, 'aa').replace(/iii+/g, 'ii').replace(/ooo+/g, 'oo');
  // Drop standalone diacritic residue and stray Arabic-presentation marks.
  out = out.replace(/[؀-ۿ]/g, '');
  return out.trim();
}

/**
 * Best-effort reverse. Roman Urdu spelling is non-standard so the result
 * should be treated as a guess; never use this for legal or financial text.
 */
export function romanToUrdu(text: string): string {
  if (!text) return '';
  // Match longest first by sorting descending on key length.
  const ordered = [...ROMAN_TO_UR_BASE].sort((a, b) => b[0].length - a[0].length);
  let out = text.toLowerCase();
  for (const [src, dst] of ordered) {
    out = out.split(src).join(dst);
  }
  return out;
}

/**
 * Heuristic: does this text contain any Urdu/Arabic-script codepoints?
 */
export function hasUrduScript(text: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text);
}

/**
 * SMS encoding helper. GSM-7 supports a fixed alphabet; everything else
 * forces UCS-2. We approximate by checking for any non-ASCII Latin
 * codepoint (the GSM-7 extension set is close enough for our text).
 */
export function smsEncoding(text: string): 'gsm-7' | 'ucs-2' {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7f£¥àèéìòùÄÖÑÜ§]*$/.test(text)
    ? 'gsm-7'
    : 'ucs-2';
}

/** Per-segment character cap for a given encoding. */
export function smsSegmentCap(encoding: 'gsm-7' | 'ucs-2'): number {
  return encoding === 'gsm-7' ? 160 : 70;
}

/** Multi-part segment cap when text exceeds a single segment. */
export function smsMultipartCap(encoding: 'gsm-7' | 'ucs-2'): number {
  return encoding === 'gsm-7' ? 153 : 67;
}

/** Compute how many SMS segments a body will occupy after encoding. */
export function smsSegmentCount(text: string): { segments: number; encoding: 'gsm-7' | 'ucs-2' } {
  const encoding = smsEncoding(text);
  const len = text.length;
  const single = smsSegmentCap(encoding);
  if (len <= single) return { segments: 1, encoding };
  const multi = smsMultipartCap(encoding);
  return { segments: Math.ceil(len / multi), encoding };
}
