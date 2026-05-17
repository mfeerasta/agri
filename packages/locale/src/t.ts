import { MESSAGES, type Locale, DEFAULT_LOCALE } from './messages.js';

export function t(key: string, locale: Locale = DEFAULT_LOCALE, fallback?: string): string {
  return MESSAGES[locale]?.[key] ?? MESSAGES.en[key] ?? fallback ?? key;
}

export function makeT(locale: Locale) {
  return (key: string, fallback?: string) => t(key, locale, fallback);
}

export function formatPkrLocalized(rupees: number, locale: Locale): string {
  const localeTag = locale === 'ur' ? 'ur-PK' : 'en-PK';
  const formatted = new Intl.NumberFormat(localeTag, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(rupees);
  return `${t('common.rs', locale)} ${formatted}`;
}

export function formatDateLocalized(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ur' ? 'ur-PK' : 'en-PK', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
