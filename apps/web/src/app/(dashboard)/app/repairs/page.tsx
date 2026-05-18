import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Masthead } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export default async function RepairsHome() {
  const locale = await getLocale();
  return (
    <div className="space-y-6">
      <Masthead section={t('repairs.title', locale)} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={'/repairs/board' as never} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)] min-h-[44px] md:min-h-[40px] inline-flex items-center">
          {t('crops.board', locale)}
        </Link>
        <Link href={'/repairs/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">
          {t('repairs.new', locale)}
        </Link>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">{t('repairs.open', locale)}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">0</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">{t('repairs.awaiting_quotes', locale)}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">0</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">{t('repairs.pending_approval', locale)}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">0</CardContent></Card>
      </div>
    </div>
  );
}
