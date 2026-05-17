import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export default async function ProcurementHome() {
  const locale = await getLocale();
  const TILES = [
    { href: '/procurement/vendors', label: t('procurement.vendors', locale), sub: 'Dealers + credit terms' },
    { href: '/procurement/purchase-orders', label: t('procurement.purchase_orders', locale), sub: 'PO list' },
    { href: '/procurement/purchase-orders/new', label: t('procurement.new_po', locale), sub: 'Approval flow' },
    { href: '/procurement/goods-received/new', label: t('procurement.new_grn', locale), sub: 'Receive + QC' },
    { href: '/procurement/purchase-invoices', label: t('procurement.invoices', locale), sub: 'Payable aging' },
  ];
  return (
    <div>
      <Masthead section={t('procurement.title', locale)} />
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
