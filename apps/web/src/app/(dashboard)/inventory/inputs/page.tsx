import Link from 'next/link';
import { db, inputs, inputPurchases, inputIssuances } from '@zameen/db';
import { eq, sql } from 'drizzle-orm';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function InputsListPage() {
  const items = await db.select().from(inputs).orderBy(inputs.name);
  const purchTotals = await db
    .select({ inputId: inputPurchases.inputId, qty: sql<string>`COALESCE(SUM(${inputPurchases.quantity}),0)` })
    .from(inputPurchases)
    .groupBy(inputPurchases.inputId);
  const issueTotals = await db
    .select({ inputId: inputIssuances.inputId, qty: sql<string>`COALESCE(SUM(${inputIssuances.quantity}),0)` })
    .from(inputIssuances)
    .groupBy(inputIssuances.inputId);
  const pIn = new Map(purchTotals.map((r) => [r.inputId, Number(r.qty)]));
  const pOut = new Map(issueTotals.map((r) => [r.inputId, Number(r.qty)]));

  return (
    <div className="space-y-2">
      <Masthead section="INPUTS" />
      <SectionDivider />
      <div className="flex justify-end gap-2">
        <Link href={'/inventory/inputs/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">New input</Link>
        <Link href={'/inventory/inputs/purchases/new' as never} className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">New purchase</Link>
        <Link href={'/inventory/inputs/issuances/new' as never} className="rounded-md bg-amber-700 px-4 py-2 text-sm text-white">Issue to field</Link>
        <Link href={'/inventory/inputs/purchases' as never} className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white">Purchases</Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState title="No inputs created" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Brand</th>
                  <th className="p-3">Unit</th><th className="p-3">On hand</th><th className="p-3">Reorder</th><th className="p-3">Expiry tracked</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const onHand = (pIn.get(i.id) ?? 0) - (pOut.get(i.id) ?? 0);
                  return (
                    <tr key={i.id} className="border-b border-[var(--rule)]">
                      <td className="p-3">{i.name}{i.nameUr ? <span dir="rtl" className="ml-2 text-xs text-slate-500">{i.nameUr}</span> : null}</td>
                      <td className="p-3">{i.type}</td>
                      <td className="p-3">{i.brand ?? ''}</td>
                      <td className="p-3">{i.unit}</td>
                      <td className="p-3 tabular">{onHand.toFixed(2)}</td>
                      <td className="p-3 tabular">{i.reorderPoint ?? ''}</td>
                      <td className="p-3">{i.expiryTracked ? 'yes' : ''}</td>
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
