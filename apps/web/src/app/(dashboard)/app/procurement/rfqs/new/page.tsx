import { db, vendors } from '@zameen/db';
import { asc, eq, and } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { computeVendorScores } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';
import { RfqNewForm } from './rfq-new-form';

export const dynamic = 'force-dynamic';

export default async function NewRfqPage() {
  const ctx = await getSessionContext();
  const vendorRows = ctx
    ? await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.entityId, ctx.entityId), eq(vendors.isActive, true)))
        .orderBy(asc(vendors.name))
    : [];
  const scores = ctx ? await computeVendorScores(ctx.entityId) : [];
  const enriched = vendorRows.map((v) => {
    const s = scores.find((x) => x.vendorId === v.id);
    return {
      id: v.id,
      name: v.name,
      category: v.category,
      onTimePct: s?.onTimeDeliveryPct ?? 0,
      quoteAccuracyPct: s?.avgQuoteAccuracyPct ?? 0,
      totalSpendPkr: s?.totalSpendPkr ?? 0,
    };
  });
  return (
    <div>
      <Masthead section="NEW RFQ" />
      <SectionDivider />
      <RfqNewForm entityId={ctx?.entityId ?? ''} vendors={enriched} />
    </div>
  );
}
