import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';
import { listCustomReports } from '@/modules/custom-reports/actions';

export const dynamic = 'force-dynamic';

export default async function ReportsHome() {
  const locale = await getLocale();
  const custom = await listCustomReports();
  const TILES = [
    { href: '/reports/daily', label: t('reports.daily', locale), sub: 'Today + weather + prices' },
    { href: '/reports/weekly', label: t('reports.weekly', locale), sub: 'KPIs vs plan' },
    { href: '/reports/seasonal', label: t('reports.seasonal', locale), sub: 'Per-field yield + cost variance' },
  ];
  return (
    <div>
      <Masthead section={t('reports.title', locale)} />
      <SectionDivider />
      <div className="flex justify-end mb-3">
        <Link
          href="/reports/new"
          className="text-xs px-3 py-1 rounded bg-[var(--accent)] text-[var(--accent-fg)]"
        >
          + Custom report
        </Link>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href as never} className="block">
            <Card className="hover:bg-[var(--paper-2)]">
              <CardHeader><CardTitle>{tile.label}</CardTitle></CardHeader>
              <CardContent className="smallcaps text-[0.7rem] text-[var(--ink)]/60">{tile.sub}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {custom.length > 0 ? (
        <div className="mt-6">
          <SectionDivider />
          <div className="text-xs smallcaps mb-2">Your reports</div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {custom.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}` as never} className="block">
                <Card className="hover:bg-[var(--paper-2)]">
                  <CardHeader><CardTitle>{r.name}</CardTitle></CardHeader>
                  <CardContent className="smallcaps text-[0.7rem] text-[var(--ink)]/60">
                    {r.dataSource} - {r.chartKind ?? 'table'}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
