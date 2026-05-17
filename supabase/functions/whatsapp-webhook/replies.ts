// Bilingual reply templates for the inbound WhatsApp NLU loop.
// Urdu primary, English fallback. Selection happens based on the
// sender's preferredLocale (zameen.users.preferred_locale).

export type Locale = 'ur' | 'en' | string;

export interface Reply {
  ur: string;
  en: string;
}

export function pickLocale(reply: Reply, locale: Locale): string {
  if (locale === 'en') return reply.en;
  // Default to bilingual Urdu first, English fallback in same message.
  return `${reply.ur}\n${reply.en}`;
}

export const replies = {
  unknownSender: {
    ur: 'آپ ابھی رجسٹرڈ نہیں ہیں۔ field.agri.feerasta.ai پر سائن اپ کریں۔',
    en: 'You are not registered yet. Sign up at field.agri.feerasta.ai',
  },
  lowConfidence: {
    ur: 'سمجھ نہیں آیا۔ دوبارہ سادہ الفاظ میں لکھیں، مثلاً: "F3 پانی لگا، 6 گھنٹے"',
    en: 'Could not understand. Please rephrase, e.g. "F3 paani laga 6 ghante"',
  },
  taskCompletionOk: {
    ur: '✓ ٹاسک مکمل درج ہو گیا',
    en: 'Task completion recorded',
  },
  dieselLogOk: {
    ur: '✓ ڈیزل لاگ درج ہوگیا',
    en: 'Diesel log recorded',
  },
  dieselPurchaseOk: {
    ur: '✓ ڈیزل خرید درج ہوگئی۔ منظوری درکار ہو تو بھیج دی گئی',
    en: 'Diesel purchase recorded. Approval sent if threshold exceeded.',
  },
  repairReportOk: {
    ur: '✓ مرمت کی درخواست درج ہو گئی',
    en: 'Repair request logged',
  },
  harvestLogOk: {
    ur: '✓ کٹائی درج ہو گئی',
    en: 'Harvest recorded',
  },
  milkLogOk: {
    ur: '✓ دودھ کا اندراج ہوگیا',
    en: 'Milk record saved',
  },
  attendanceInOk: {
    ur: '✓ حاضری لگ گئی (GPS نہیں)',
    en: 'Checked in (no GPS via WhatsApp)',
  },
  attendanceOutOk: {
    ur: '✓ چھٹی درج ہوگئی',
    en: 'Checked out',
  },
  commentOk: {
    ur: '✓ تبصرہ شامل ہو گیا',
    en: 'Comment added',
  },
  internalError: {
    ur: 'سرور خرابی۔ بعد میں کوشش کریں',
    en: 'Server error. Try again later.',
  },
} as const;

export function clarificationMessage(
  qs: Array<{ field: string; question: string }>,
  locale: Locale,
): string {
  if (qs.length === 0) return pickLocale(replies.lowConfidence, locale);
  const lines = qs.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
  const head = locale === 'en' ? 'I need a bit more info:' : 'تھوڑی اور تفصیل چاہیے / Need more info:';
  return `${head}\n${lines}`;
}

export function confirmTaskCompletion(taskTitle: string, locale: Locale): string {
  const r = {
    ur: `✓ ٹاسک "${taskTitle}" مکمل درج ہو گیا`,
    en: `Task "${taskTitle}" marked complete`,
  };
  return pickLocale(r, locale);
}

export function confirmDieselLog(args: {
  litres: number;
  totalPkr: number;
  remainingTankLitres?: number | null;
  locale: Locale;
}): string {
  const remaining =
    args.remainingTankLitres == null ? '' : ` | ٹینک باقی ${args.remainingTankLitres} L`;
  const r = {
    ur: `✓ ${args.litres} L ڈیزل، PKR ${args.totalPkr.toLocaleString()}${remaining}`,
    en: `Diesel: ${args.litres} L, PKR ${args.totalPkr.toLocaleString()}${
      args.remainingTankLitres == null ? '' : ` | Tank left ${args.remainingTankLitres} L`
    }`,
  };
  return pickLocale(r, args.locale);
}

export function confirmRepairRequest(requestNumber: string, locale: Locale): string {
  const r = {
    ur: `✓ مرمت درخواست ${requestNumber} درج ہو گئی`,
    en: `Repair request ${requestNumber} created`,
  };
  return pickLocale(r, locale);
}

export function confirmHarvest(kg: number, locale: Locale): string {
  const r = {
    ur: `✓ کٹائی درج: ${kg} کلو`,
    en: `Harvest recorded: ${kg} kg`,
  };
  return pickLocale(r, locale);
}

export function confirmMilk(totalLitres: number, locale: Locale): string {
  const r = {
    ur: `✓ ${totalLitres} L دودھ درج ہو گیا`,
    en: `Milk recorded: ${totalLitres} L`,
  };
  return pickLocale(r, locale);
}
