import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { db, dieselAnomalies } from '@zameen/db';
import { eq, count } from 'drizzle-orm';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function DieselHome() {
  const locale = await getLocale();
  const [openRow] = await db
    .select({ n: count() })
    .from(dieselAnomalies)
    .where(eq(dieselAnomalies.status, 'open'));
  const [critRow] = await db
    .select({ n: count() })
    .from(dieselAnomalies)
    .where(eq(dieselAnomalies.severity, 'critical'));
  const openCount = Number(openRow?.n ?? 0);
  const critCount = Number(critRow?.n ?? 0);

  return (
    <div className="space-y-6">
      {openCount > 0 ? (
        <Link
          href={'/diesel/anomalies' as never}
          className="block rounded-md border px-4 py-3 text-sm"
          style={{
            borderColor: critCount > 0 ? 'var(--danger)' : 'var(--warning)',
            background: critCount > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
            color: critCount > 0 ? 'var(--danger)' : 'var(--warning)',
          }}
        >
          {openCount} {t('diesel.open_anomalies_alert', locale)}
          {critCount > 0 ? ` (${critCount} ${t('dashboard.critical', locale)})` : ''}. {t('diesel.review_acknowledge', locale)}.
        </Link>
      ) : null}
      <Masthead section={t('diesel.title', locale)} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={'/diesel/purchases/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">{t('diesel.new_purchase', locale)}</Link>
        <Link href={'/diesel/logs/new' as never} className="rounded-md bg-emerald-600 px-4 py-2 text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">{t('diesel.daily_log', locale)}</Link>
        <Link href={'/diesel/reconcile' as never} className="rounded-md bg-slate-700 px-4 py-2 text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">{t('diesel.reconcile', locale)}</Link>
        <Link href={'/diesel/anomalies' as never} className="rounded-md bg-slate-600 px-4 py-2 text-white min-h-[44px] md:min-h-[40px] inline-flex items-center">{t('dashboard.open_anomalies', locale)}</Link>
      </div>
      <SectionDivider />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('diesel.stock_today', locale)}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">0 L</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('diesel.cost_per_acre_30d', locale)}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('diesel.lph_30d', locale)}</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('dashboard.open_anomalies', locale)}</CardTitle></CardHeader>
          <CardContent
            className="text-3xl font-semibold"
            style={{ color: critCount > 0 ? 'var(--danger)' : openCount > 0 ? 'var(--warning)' : undefined }}
          >
            {openCount}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
