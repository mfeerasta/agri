import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

const TILES = [
  { href: '/reports/daily', label: 'Daily ops', sub: 'Today + weather + prices' },
  { href: '/reports/weekly', label: 'Weekly management', sub: 'KPIs vs plan' },
  { href: '/reports/seasonal', label: 'Seasonal review', sub: 'Per-field yield + cost variance' },
];

export default function ReportsHome() {
  return (
    <div>
      <Masthead section="REPORTS" />
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
