import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';

export default async function ComplianceHome() {
  const locale = await getLocale();
  const TILES = [
    { href: '/compliance/documents', label: t('compliance.documents', locale), sub: 'Fard, mutations, deeds' },
    { href: '/compliance/tax-filings', label: t('compliance.tax_filings', locale), sub: 'Agri tax, income tax' },
    { href: '/compliance/subsidies', label: t('compliance.subsidies', locale), sub: 'Kissan Card, urea' },
    { href: '/compliance/spray-diary', label: t('compliance.spray_diary', locale), sub: 'Pesticide log' },
  ];
  return (
    <div>
      <Masthead section={t('compliance.title', locale)} />
      <SectionDivider />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
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
