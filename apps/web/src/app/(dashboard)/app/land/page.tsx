import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

const TILES = [
  { href: '/land/leases', titleEn: 'Leases & tenants', titleUr: 'معاہدے و کرایہ دار', caption: 'Owned, rented, sharecrop' },
  { href: '/fields', titleEn: 'Fields & polygons', titleUr: 'کھیت', caption: 'Boundary, soil, crop plan' },
  { href: '/fields/map', titleEn: 'Field map', titleUr: 'نقشہ', caption: 'Visual layout' },
  { href: '/compliance/documents', titleEn: 'Land documents', titleUr: 'دستاویزات', caption: 'Fard, mutation, deeds' },
];

export default function LandHubPage(): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Masthead section="Land · زمین" />
      <SectionDivider />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href as never} className="block">
            <Card className="hover:bg-slate-50 transition">
              <CardHeader><CardTitle>{t.titleEn} · {t.titleUr}</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600">{t.caption}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
