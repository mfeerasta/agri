import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

const TILES = [
  { href: '/sales/buyers', label: 'Buyers', sub: 'Mills + private + dairy' },
  { href: '/sales/arhtis', label: 'Arhtis', sub: 'Mandi commission agents' },
  { href: '/sales/mandi-dispatches', label: 'Mandi dispatches', sub: 'Outbound loads' },
  { href: '/sales/mandi-dispatches/new', label: 'New dispatch', sub: 'Crop sale flow' },
  { href: '/sales/mandi-settlements/new', label: 'Settlement entry', sub: 'Patti + deductions' },
  { href: '/sales/milk', label: 'Milk', sub: 'Dispatches + settlements' },
];

export default function SalesHome() {
  return (
    <div>
      <Masthead section="SALES" />
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
