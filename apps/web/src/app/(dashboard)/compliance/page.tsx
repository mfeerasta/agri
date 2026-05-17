import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

const TILES = [
  { href: '/compliance/documents', label: 'Documents', sub: 'Fard, mutations, deeds' },
  { href: '/compliance/tax-filings', label: 'Tax filings', sub: 'Agri tax, income tax' },
  { href: '/compliance/subsidies', label: 'Subsidies', sub: 'Kissan Card, urea' },
  { href: '/compliance/spray-diary', label: 'Spray diary', sub: 'Pesticide log' },
];

export default function ComplianceHome() {
  return (
    <div>
      <Masthead section="COMPLIANCE" />
      <SectionDivider />
      <div className="grid gap-3 md:grid-cols-2">
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
