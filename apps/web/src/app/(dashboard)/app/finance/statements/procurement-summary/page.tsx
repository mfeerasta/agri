import { db, purchaseInvoices, vendors, purchaseOrders } from '@zameen/db';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface SearchParams {
  from?: string;
  to?: string;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function ProcurementSummaryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const range = { from: sp.from ?? defaultRange().from, to: sp.to ?? defaultRange().to };
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Sign in required.</div>;

  const invoices = await db
    .select()
    .from(purchaseInvoices)
    .where(
      and(
        eq(purchaseInvoices.entityId, ctx.entityId),
        gte(purchaseInvoices.invoiceDate, range.from),
        lte(purchaseInvoices.invoiceDate, range.to),
      ),
    );

  const vendorIds = Array.from(new Set(invoices.map((i) => i.vendorId)));
  const vendorRows = vendorIds.length
    ? await db.select().from(vendors).where(inArray(vendors.id, vendorIds))
    : [];
  const vendorById = new Map(vendorRows.map((v) => [v.id, v]));

  // Map PO category via vendor category fallback.
  const poIds = invoices.map((i) => i.purchaseOrderId).filter((x): x is string => !!x);
  const poRows = poIds.length
    ? await db.select().from(purchaseOrders).where(inArray(purchaseOrders.id, poIds))
    : [];
  const poById = new Map(poRows.map((p) => [p.id, p]));

  const byCategory = new Map<string, number>();
  const byVendor = new Map<string, number>();
  let total = 0;
  for (const inv of invoices) {
    const amt = Number(inv.totalPkr);
    total += amt;
    const cat = vendorById.get(inv.vendorId)?.category ?? 'uncategorized';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + amt);
    byVendor.set(inv.vendorId, (byVendor.get(inv.vendorId) ?? 0) + amt);
  }

  const topVendors = Array.from(byVendor.entries())
    .map(([vid, amt]) => ({
      vendorId: vid,
      name: vendorById.get(vid)?.name ?? vid,
      amount: amt,
      sharePct: total > 0 ? (amt / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Concentration ratio (HHI): sum of squared market shares (0-10000).
  const hhi = topVendors.reduce((s, v) => s + Math.pow(v.sharePct, 2), 0);
  // Top-3 concentration ratio.
  const cr3 = topVendors.slice(0, 3).reduce((s, v) => s + v.sharePct, 0);

  const categoryRows = Array.from(byCategory.entries())
    .map(([cat, amt]) => ({ category: cat, amount: amt, sharePct: total > 0 ? (amt / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  void poById; // reserved for future PO-level category mapping

  return (
    <div>
      <Masthead section="PROCUREMENT SUMMARY" />
      <SectionDivider />
      <div className="text-sm text-[var(--ink)]/70 mb-3 tabular">
        Period: {range.from} → {range.to} · Total billed: {total.toLocaleString('en-PK')} PKR
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Spend by category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Category</th>
                <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Amount (PKR)</th>
                <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Share</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((r) => (
                <tr key={r.category} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.category}</td>
                  <td className="px-3 py-2 text-right tabular">{r.amount.toLocaleString('en-PK')}</td>
                  <td className="px-3 py-2 text-right tabular text-xs">{r.sharePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>
            Vendor concentration · top-3 {cr3.toFixed(1)}% · HHI {hhi.toFixed(0)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Vendor</th>
                <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Amount (PKR)</th>
                <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Share</th>
              </tr>
            </thead>
            <tbody>
              {topVendors.map((v) => (
                <tr key={v.vendorId} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2">{v.name}</td>
                  <td className="px-3 py-2 text-right tabular">{v.amount.toLocaleString('en-PK')}</td>
                  <td className="px-3 py-2 text-right tabular text-xs">{v.sharePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
