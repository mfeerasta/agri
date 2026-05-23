import { and, desc, eq } from 'drizzle-orm';
import { db, arInvoices } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'partial', 'paid', 'overdue', 'disputed', 'written_off', 'void'] as const;

export default async function ArInvoicesList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;
  const status = sp.status;

  const rows = entityId
    ? await db
        .select()
        .from(arInvoices)
        .where(status ? and(eq(arInvoices.entityId, entityId), eq(arInvoices.status, status)) : eq(arInvoices.entityId, entityId))
        .orderBy(desc(arInvoices.invoiceDate))
        .limit(200)
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Masthead section="AR invoices" />

      <div className="flex flex-wrap items-center gap-2">
        <a href="/finance/ar/invoices/new" className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-1 text-xs text-[var(--paper)]">+ new invoice</a>
        <a
          href="/finance/ar/invoices"
          className={`smallcaps rounded-sm px-2 py-1 text-xs ${!status ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'}`}
        >all</a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/finance/ar/invoices?status=${s}`}
            className={`smallcaps rounded-sm px-2 py-1 text-xs ${status === s ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'}`}
          >{s}</a>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Invoices ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No invoices" hint="Create one from a dispatch or contract delivery." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="smallcaps text-xs text-[var(--zameen-600)]">
                  <th className="text-left">Invoice #</th>
                  <th className="text-left">Date</th>
                  <th className="text-left">Due</th>
                  <th className="text-left">Buyer</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--paper-2)]">
                    <td className="font-mono text-xs">{r.invoiceNumber}</td>
                    <td>{r.invoiceDate}</td>
                    <td>{r.dueDate}</td>
                    <td className="font-mono text-xs">{r.buyerId.slice(0, 8)}</td>
                    <td className="tabular text-right"><Pkr value={Number(r.totalPkr)} /></td>
                    <td className="tabular text-right"><Pkr value={Number(r.paidPkr)} /></td>
                    <td className="tabular text-right font-semibold"><Pkr value={Number(r.outstandingPkr)} /></td>
                    <td><span className="smallcaps text-xs">{r.status}</span></td>
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
