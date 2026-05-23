import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadQualityHubSummary } from '@/modules/quality/actions';

export const dynamic = 'force-dynamic';

export default async function QualityHub() {
  const ctx = await getSessionContext();
  const summary = ctx?.entityId
    ? await loadQualityHubSummary(ctx.entityId)
    : { lotsTested: 0, passRatePct: 0, openComplaints: 0, totalResolutionCostPkr: 0 };

  const tiles = [
    {
      href: '/app/quality/lab-tests',
      title: 'Lab tests',
      caption: `${summary.lotsTested} lots tested, ${summary.passRatePct}% pass rate`,
    },
    {
      href: '/app/quality/grading-standards',
      title: 'Grading standards',
      caption: 'PASSCO wheat, PSQCA rice, PCSI cotton, buyer-specific variants',
    },
    {
      href: '/app/quality/post-harvest',
      title: 'Post-harvest events',
      caption: 'Threshing, cleaning, drying, sorting, grading, bagging',
    },
    {
      href: '/app/quality/complaints',
      title: 'Buyer complaints',
      caption: `${summary.openComplaints} open, PKR ${summary.totalResolutionCostPkr.toLocaleString()} settled`,
    },
  ];

  return (
    <div className="space-y-2">
      <Masthead section="Quality assurance" />
      <SectionDivider />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Lots tested</CardTitle></CardHeader>
          <CardContent className="text-2xl">{summary.lotsTested}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pass rate</CardTitle></CardHeader>
          <CardContent className="text-2xl">{summary.passRatePct}%</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Open complaints</CardTitle></CardHeader>
          <CardContent className="text-2xl">{summary.openComplaints}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Resolution cost (PKR)</CardTitle></CardHeader>
          <CardContent className="text-2xl">{summary.totalResolutionCostPkr.toLocaleString()}</CardContent>
        </Card>
      </div>
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
