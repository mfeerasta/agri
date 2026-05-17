import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';

export default function InventoryHub() {
  return (
    <div className="space-y-2">
      <Masthead section="INVENTORY" />
      <SectionDivider />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { href: '/inventory/inputs', title: 'Inputs', caption: 'Seeds, fertilizer, pesticide' },
          { href: '/inventory/produce', title: 'Produce', caption: 'Harvested lots, storage' },
          { href: '/inventory/assets', title: 'Assets', caption: 'Tractors, implements, plant' },
        ].map((t) => (
          <Link key={t.href} href={t.href as never}>
            <Card>
              <CardHeader><CardTitle>{t.title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-500">{t.caption}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
