import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

const TILES = [
  { href: '/procurement/vendors', label: 'Vendors', sub: 'Dealers + credit terms' },
  { href: '/procurement/purchase-orders', label: 'Purchase orders', sub: 'PO list' },
  { href: '/procurement/purchase-orders/new', label: 'New PO', sub: 'Approval flow' },
  { href: '/procurement/goods-received/new', label: 'New GRN', sub: 'Receive + QC' },
  { href: '/procurement/purchase-invoices', label: 'Invoices', sub: 'Payable aging' },
];

export default function ProcurementHome() {
  return (
    <div>
      <Masthead section="PROCUREMENT" />
      <SectionDivider />
      <div className="grid gap-3 md:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href as never} className="block">
            <Card className="hover:bg-[var(--paper-2)]">
              <CardHeader><CardTitle>{t.label}</CardTitle></CardHeader>
              <CardContent className="smallcaps text-[0.7rem] text-[var(--ink)]/60">{t.sub}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
