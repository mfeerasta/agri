import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export default async function SalesHome() {
  const locale = await getLocale();
  const TILES = [
    { href: '/sales/buyers', label: t('sales.buyers', locale), sub: 'Mills + private + dairy' },
    { href: '/sales/arhtis', label: t('sales.arhtis', locale), sub: 'Mandi commission agents' },
    { href: '/sales/mandi-dispatches', label: t('sales.mandi_dispatches', locale), sub: 'Outbound loads' },
    { href: '/sales/mandi-dispatches/new', label: t('sales.new_dispatch', locale), sub: 'Crop sale flow' },
    { href: '/sales/mandi-settlements/new', label: t('sales.settlement', locale), sub: 'Patti + deductions' },
    { href: '/sales/milk', label: t('sales.milk', locale), sub: 'Dispatches + settlements' },
  ];
  return (
    <div>
      <Masthead section={t('sales.title', locale)} />
      <SectionDivider />
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
    </div>
  );
}
