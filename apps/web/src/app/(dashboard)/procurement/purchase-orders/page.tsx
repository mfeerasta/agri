import Link from 'next/link';
import { db, purchaseOrders } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage() {
  const rows = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.poDate)).limit(100);
  return (
    <div>
      <Masthead section="PURCHASE ORDERS" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">{rows.length} POs</div>
        <Link href={'/procurement/purchase-orders/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">New PO</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent POs</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No POs yet.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">No.</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Vendor</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Total</th>
              </tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs"><Link href={`/procurement/purchase-orders/${p.id}` as never} className="hover:underline">{p.poNumber}</Link></td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(p.poDate)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.vendorId.slice(0, 8)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{p.status}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={p.totalPkr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
