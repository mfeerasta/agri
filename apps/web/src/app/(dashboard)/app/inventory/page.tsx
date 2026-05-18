import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export default async function InventoryHub() {
  const locale = await getLocale();
  const tiles = [
    { href: '/inventory/inputs', title: t('inventory.inputs', locale), caption: 'Seeds, fertilizer, pesticide' },
    { href: '/inventory/produce', title: t('inventory.produce', locale), caption: 'Harvested lots, storage' },
    { href: '/inventory/assets', title: t('inventory.assets', locale), caption: 'Tractors, implements, plant' },
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
