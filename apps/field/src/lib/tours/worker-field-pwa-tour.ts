import type { TourStep } from '@zameen/ui';

/**
 * Eight-step in-context guided tour for the field PWA. Run on demand from the
 * worker home or auto-trigger once on first login. Distinct from the existing
 * `/training` page which is a sandboxed simulator. This is a guided overlay on
 * the real UI.
 *
 * Selectors target `data-tour` attributes on home, attendance, tasks, diesel,
 * repair, photos, and voice flows. Strings are in Urdu Nastaliq because the
 * default field locale is `ur`.
 */
export const workerFieldPwaTour: TourStep[] = [
  {
    selector: '[data-tour="field-home"]',
    title: 'خوش آمدید',
    body: 'یہ آپ کا ہوم اسکرین ہے۔ ہر بڑا کام یہاں سے شروع کریں۔',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="field-attendance"]',
    title: 'حاضری',
    body: 'صبح سب سے پہلے یہ بٹن دباؤ۔ GPS سبز ٹِک آئے تو حاضری لگ جائے گی۔',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="field-tasks"]',
    title: 'آج کے کام',
    body: 'یہاں آپ کے آج کے کام ہیں۔ ہر کام پر تصویر لگائیں اور مکمل ہونے پر سبز ٹِک دبائیں۔',
    placement: 'right',
  },
  {
    selector: '[data-tour="field-photo"]',
    title: 'تصویر',
    body: 'ہر کام، ہر رسید کی تصویر۔ یہ ثبوت ہے۔ ایپ خود بخود بھیج دے گی۔',
    placement: 'top',
  },
  {
    selector: '[data-tour="field-voice"]',
    title: 'آواز',
    body: 'لکھنا مشکل ہو تو مائیک دبائیں اور بولیں۔ ایپ خود لکھ دے گی۔',
    placement: 'top',
  },
  {
    selector: '[data-tour="field-diesel"]',
    title: 'ڈیزل',
    body: 'ہر بار جب ڈیزل ڈلوائیں، رسید کی تصویر کے ساتھ یہاں اندراج کریں۔',
    placement: 'right',
  },
  {
    selector: '[data-tour="field-repair"]',
    title: 'مرمت',
    body: 'کوئی چیز ٹوٹے، خراب ہو، یا ٹھیک نہ چلے تو یہاں سے درخواست بھیجیں۔ تصویر ضرور لگائیں۔',
    placement: 'right',
  },
  {
    selector: '[data-tour="field-sync-status"]',
    title: 'آف لائن',
    body: 'سگنل نہ ہو تو ایپ سب کچھ محفوظ رکھتی ہے۔ سگنل آتے ہی خود بخود بھیج دے گی۔ اوپر یہ نشان دیکھیں۔',
    placement: 'bottom',
  },
];

export const WORKER_FIELD_PWA_TOUR_ID = 'field-worker-onboarding-v1';
