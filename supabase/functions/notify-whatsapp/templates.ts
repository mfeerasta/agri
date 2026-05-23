// Template registry for the dedicated WhatsApp notification dispatcher.
//
// All template names below must be pre-registered and approved in Meta
// Business Manager. Body parameters are positional ({{1}}, {{2}}, ...).
// Languages used:
//   - 'ur'  Urdu (default for workers)
//   - 'en'  English (admin and approver fallback)
//
// Required Meta templates:
//   zameen_approval_pending      (en, ur)  body: {{1}} requester, {{2}} type, {{3}} amount
//   zameen_weather_alert_frost   (ur)      body: {{1}} field, {{2}} min temp C, {{3}} date
//   zameen_weather_alert_heatwave(ur)      body: {{1}} field, {{2}} max temp C, {{3}} date
//   zameen_locust_alert          (ur)      body: {{1}} district, {{2}} severity, {{3}} eta hours
//   zameen_daily_digest          (en)      body: {{1}} date, {{2}} summary line
//   zameen_attendance_reminder   (ur)      body: {{1}} worker name, {{2}} farm name
//   zameen_harvest_ready         (ur)      body: {{1}} crop, {{2}} field, {{3}} eta days
//   zameen_payment_made          (en)      body: {{1}} payee, {{2}} amount, {{3}} voucher
//   zameen_low_inventory         (en)      body: {{1}} item, {{2}} balance, {{3}} reorder qty

export type TemplateLang = 'ur' | 'en';

export interface TemplateDef {
  kind: string;
  name: string;
  languageCode: TemplateLang;
  params: (data: Record<string, unknown>) => string[];
  hasUrlButton?: boolean;
}

function s(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export const TEMPLATES: Record<string, TemplateDef> = {
  approval_pending: {
    kind: 'approval_pending',
    name: 'zameen_approval_pending',
    languageCode: 'en',
    hasUrlButton: true,
    params: (d) => [s(d.requesterName), s(d.approvalType), s(d.amountPkrFormatted)],
  },
  weather_alert_frost: {
    kind: 'weather_alert_frost',
    name: 'zameen_weather_alert_frost',
    languageCode: 'ur',
    params: (d) => [s(d.fieldName), s(d.minTempC), s(d.forecastDate)],
  },
  weather_alert_heatwave: {
    kind: 'weather_alert_heatwave',
    name: 'zameen_weather_alert_heatwave',
    languageCode: 'ur',
    params: (d) => [s(d.fieldName), s(d.maxTempC), s(d.forecastDate)],
  },
  locust_alert: {
    kind: 'locust_alert',
    name: 'zameen_locust_alert',
    languageCode: 'ur',
    params: (d) => [s(d.district), s(d.severity), s(d.etaHours)],
  },
  daily_digest: {
    kind: 'daily_digest',
    name: 'zameen_daily_digest',
    languageCode: 'en',
    hasUrlButton: true,
    params: (d) => [s(d.date), s(d.summary)],
  },
  attendance_reminder: {
    kind: 'attendance_reminder',
    name: 'zameen_attendance_reminder',
    languageCode: 'ur',
    params: (d) => [s(d.workerName), s(d.farmName)],
  },
  harvest_ready: {
    kind: 'harvest_ready',
    name: 'zameen_harvest_ready',
    languageCode: 'ur',
    params: (d) => [s(d.crop), s(d.fieldName), s(d.etaDays)],
  },
  payment_made: {
    kind: 'payment_made',
    name: 'zameen_payment_made',
    languageCode: 'en',
    params: (d) => [s(d.payeeName), s(d.amountPkrFormatted), s(d.voucherNo)],
  },
  low_inventory: {
    kind: 'low_inventory',
    name: 'zameen_low_inventory',
    languageCode: 'en',
    hasUrlButton: true,
    params: (d) => [s(d.itemName), s(d.balance), s(d.reorderQty)],
  },
};

export function resolveTemplate(category: string): TemplateDef | null {
  return TEMPLATES[category] ?? null;
}
