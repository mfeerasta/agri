import { db, vendors } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { computeVendorScores } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function toneFor(pct: number): string {
  if (pct >= 85) return 'var(--success)';
  if (pct >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!vendor) notFound();

  const scores = ctx ? await computeVendorScores(ctx.entityId) : [];
  const score = scores.find((s) => s.vendorId === id);

  return (
    <div>
      <Masthead section={`VENDOR · ${vendor.code}`} />
      <SectionDivider />
      <h1 className="text-2xl font-semibold mb-3">{vendor.name}</h1>

      {score ? (
        <div className="grid gap-3 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Total spend</div>
              <div className="text-xl font-semibold tabular">
                {score.totalSpendPkr.toLocaleString('en-PK')} PKR
              </div>
              <div className="text-xs text-[var(--fg-muted)] tabular">{score.orderCount} POs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">On-time delivery</div>
              <div
                className="text-xl font-semibold tabular"
                style={{ color: toneFor(score.onTimeDeliveryPct) }}
              >
                {score.onTimeDeliveryPct.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Quote accuracy</div>
              <div
                className="text-xl font-semibold tabular"
                style={{ color: toneFor(score.avgQuoteAccuracyPct) }}
              >
                {score.avgQuoteAccuracyPct.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">QC fail rate</div>
              <div
                className="text-xl font-semibold tabular"
                style={{ color: score.qcFailRate > 5 ? 'var(--danger)' : undefined }}
              >
                {score.qcFailRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-4 grid gap-2 md:grid-cols-2 text-sm">
          <div><span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Code · </span><span className="font-mono">{vendor.code}</span></div>
          <div><span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Category · </span>{vendor.category ?? '—'}</div>
          <div><span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Phone · </span>{vendor.phone ?? '—'}</div>
          <div><span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">NTN · </span>{vendor.ntn ?? '—'}</div>
          <div><span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Credit terms · </span>{vendor.creditTermsDays} days</div>
          <div className="md:col-span-2"><span className="smallcaps text-[0.7rem] text-[var(--fg-muted)]">Address · </span>{vendor.address ?? '—'}</div>
        </CardContent>
      </Card>
    </div>
  );
}
