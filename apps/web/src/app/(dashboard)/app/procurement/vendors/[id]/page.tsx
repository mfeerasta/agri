import { db, vendors, rfqs, rfqInvitations, rfqQuotes, purchaseInvoices } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { computeVendorScores } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';
import { notFound } from 'next/navigation';
import { fmtDate } from '@/lib/format';

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

  // RFQ history.
  const [invited, vendorQuotes, lifetimeInvoices] = await Promise.all([
    db.select().from(rfqInvitations).where(eq(rfqInvitations.vendorId, id)),
    db.select().from(rfqQuotes).where(eq(rfqQuotes.vendorId, id)),
    ctx
      ? db
          .select()
          .from(purchaseInvoices)
          .where(eq(purchaseInvoices.vendorId, id))
          .orderBy(desc(purchaseInvoices.invoiceDate))
          .limit(50)
      : Promise.resolve([] as Array<typeof purchaseInvoices.$inferSelect>),
  ]);
  const rfqIds = Array.from(new Set([...invited.map((i) => i.rfqId), ...vendorQuotes.map((q) => q.rfqId)]));
  const rfqRows = rfqIds.length
    ? await Promise.all(
        rfqIds.map(async (rid) => (await db.select().from(rfqs).where(eq(rfqs.id, rid)).limit(1))[0]),
      )
    : [];
  const rfqById = new Map(rfqRows.filter(Boolean).map((r) => [r!.id, r!]));
  const wonCount = vendorQuotes.filter((q) => q.isWinner).length;
  const lostCount = vendorQuotes.length - wonCount;
  const lifetimeSpend = lifetimeInvoices.reduce((s, i) => s + Number(i.totalPkr), 0);

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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            RFQ activity · invited {invited.length} · won {wonCount} · lost {lostCount} · lifetime spend{' '}
            {lifetimeSpend.toLocaleString('en-PK')} PKR
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invited.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No RFQ activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.65rem]">RFQ</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.65rem]">Title</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.65rem]">Invited</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.65rem]">Status</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.65rem]">Quote (PKR)</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.65rem]">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {invited.map((inv) => {
                  const r = rfqById.get(inv.rfqId);
                  const q = vendorQuotes.find((qq) => qq.rfqId === inv.rfqId);
                  const outcome = q ? (q.isWinner ? 'won' : 'lost') : inv.declinedReason ? 'declined' : 'pending';
                  return (
                    <tr key={inv.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link href={`/procurement/rfqs/${inv.rfqId}` as never} className="underline">
                          {r?.rfqNumber ?? inv.rfqId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{r?.title ?? '—'}</td>
                      <td className="px-3 py-2 tabular text-xs">
                        {inv.sentAt ? fmtDate(inv.sentAt) : '—'}
                      </td>
                      <td className="px-3 py-2 smallcaps text-[0.65rem]">{r?.status ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular text-xs">
                        {q ? Number(q.totalPkr).toLocaleString('en-PK') : '—'}
                      </td>
                      <td className="px-3 py-2 smallcaps text-[0.65rem]">{outcome}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
