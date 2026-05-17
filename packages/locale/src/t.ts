import { MESSAGES, type Locale, DEFAULT_LOCALE } from './messages.js';

const FALLBACK_CHAIN: Record<Locale, Locale[]> = {
  ur: ['ur', 'en'],
  roman_ur: ['roman_ur', 'en'],
  pa: ['pa', 'ur', 'en'],
  hi: ['hi', 'en'],
  en: ['en'],
};

export function t(key: string, locale: Locale = DEFAULT_LOCALE, fallback?: string): string {
  const chain = FALLBACK_CHAIN[locale] ?? ['en'];
  for (const loc of chain) {
    const v = MESSAGES[loc]?.[key];
    if (v !== undefined) return v;
  }
  return fallback ?? key;
}

export function makeT(locale: Locale) {
  return (key: string, fallback?: string) => t(key, locale, fallback);
}

function intlTag(locale: Locale): string {
  switch (locale) {
    case 'ur':
      return 'ur-PK';
    case 'pa':
      return 'pa-PK';
    case 'hi':
      return 'hi-IN';
    case 'roman_ur':
    case 'en':
    default:
      return 'en-PK';
  }
}

export function formatPkrLocalized(rupees: number, locale: Locale, opts?: { useDevanagariNumerals?: boolean }): string {
  const useDeva = opts?.useDevanagariNumerals && locale === 'hi';
  const tag = useDeva ? 'hi-IN-u-nu-deva' : intlTag(locale);
  const formatted = new Intl.NumberFormat(tag, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(rupees);
  return `${t('common.rs', locale)} ${formatted}`;
}

export function formatDateLocalized(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTag(locale), { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ur' || locale === 'pa' ? 'rtl' : 'ltr';
}

export function localeHtmlLang(locale: Locale): string {
  switch (locale) {
    case 'ur':
      return 'ur';
    case 'pa':
      return 'pa-PK';
    case 'hi':
      return 'hi';
    case 'roman_ur':
      return 'en';
    case 'en':
    default:
      return 'en';
  }
}
