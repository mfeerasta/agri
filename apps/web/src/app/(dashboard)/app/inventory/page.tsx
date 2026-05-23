import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';
import { getSessionContext } from '@/lib/session';
import { loadInventoryHubSummary } from '@/modules/inventory/forecast-actions';

export const dynamic = 'force-dynamic';

export default async function InventoryHub() {
  const locale = await getLocale();
  const ctx = await getSessionContext();
  const summary = ctx?.entityId
    ? await loadInventoryHubSummary(ctx.entityId)
    : { belowReorderPointCount: 0, stockoutRiskWithin7Count: 0, openAnomaliesCount: 0 };

  const tiles = [
    { href: '/inventory/inputs', title: t('inventory.inputs', locale), caption: 'Seeds, fertilizer, pesticide' },
    { href: '/inventory/fertilizer-log', title: 'کھاد لاگ / Fertilizer log', caption: 'Daily plot-wise consumption matrix' },
    { href: '/inventory/pesticide-log', title: 'زرعی دوا لاگ / Pesticide log', caption: 'Daily plot-wise spray matrix with PHI flags' },
    { href: '/inventory/seed-log', title: 'بیج لاگ / Seed log', caption: 'Daily plot-wise seeding matrix with rate flags' },
    { href: '/inventory/produce', title: t('inventory.produce', locale), caption: 'Harvested lots, storage' },
    { href: '/inventory/assets', title: t('inventory.assets', locale), caption: 'Tractors, implements, plant' },
    {
      href: '/inventory/forecasts',
      title: 'Forecasts and reorder',
      caption: `${summary.belowReorderPointCount} items below reorder point, ${summary.stockoutRiskWithin7Count} stockout risk in 7 days`,
    },
    {
      href: '/inventory/anomalies',
      title: 'Usage anomalies',
      caption: `${summary.openAnomaliesCount} open anomalies to review`,
    },
  ];
  return (
    <div className="space-y-2">
      <Masthead section={t('inventory.title', locale)} />
      <SectionDivider />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href as never}>
            <Card>
              <CardHeader><CardTitle>{tile.title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-500">{tile.caption}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
