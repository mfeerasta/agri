import Link from 'next/link';
import { db, inputPurchases, inputs } from '@zameen/db';
import { desc, eq, sql, gte } from 'drizzle-orm';
import { Card, CardContent, EmptyState, Masthead, Pkr, SectionDivider, StatBlock } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InputPurchasesPage() {
  const since = new Date(Date.now() - 30 * 86_400_000);

  const purchases = await db
    .select({
      id: inputPurchases.id,
      purchasedOn: inputPurchases.purchasedOn,
      quantity: inputPurchases.quantity,
      totalPkr: inputPurchases.totalPkr,
      invoiceNumber: inputPurchases.invoiceNumber,
      batchNumber: inputPurchases.batchNumber,
      inputName: inputs.name,
      inputType: inputs.type,
    })
    .from(inputPurchases)
    .leftJoin(inputs, eq(inputs.id, inputPurchases.inputId))
    .orderBy(desc(inputPurchases.purchasedOn));

  const spend30d = await db
    .select({ type: inputs.type, total: sql<string>`COALESCE(SUM(${inputPurchases.totalPkr}),0)` })
    .from(inputPurchases)
    .leftJoin(inputs, eq(inputs.id, inputPurchases.inputId))
    .where(gte(inputPurchases.purchasedOn, since))
    .groupBy(inputs.type);

  return (
    <div className="space-y-2">
      <Masthead section="INPUTS / PURCHASES" />
      <SectionDivider />
      <div className="flex justify-end">
        <Link href={'/inventory/inputs/purchases/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">
          New purchase
        </Link>
      </div>
      <SectionDivider label="30-day spend" />
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        {spend30d.length === 0 ? (
          <StatBlock label="Spend" value={<Pkr value={0} mode="lac_crore" />} />
        ) : (
          spend30d.map((s) => (
            <StatBlock key={s.type ?? 'na'} label={s.type ?? 'misc'} value={<Pkr value={Number(s.total)} mode="lac_crore" />} />
          ))
        )}
      </div>
      <SectionDivider label="Purchases" />
      <Card>
        <CardContent className="p-0">
          {purchases.length === 0 ? (
            <EmptyState title="No purchases yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Date</th><th className="p-3">Input</th><th className="p-3">Qty</th><th className="p-3">Invoice</th><th className="p-3">Batch</th><th className="p-3">Total</th></tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">{fmtDate(p.purchasedOn)}</td>
                    <td className="p-3">{p.inputName} <span className="text-xs text-slate-500">({p.inputType})</span></td>
                    <td className="p-3 tabular">{Number(p.quantity).toFixed(2)}</td>
                    <td className="p-3">{p.invoiceNumber ?? ''}</td>
                    <td className="p-3">{p.batchNumber ?? ''}</td>
                    <td className="p-3 tabular"><Pkr value={Number(p.totalPkr)} /></td>
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
