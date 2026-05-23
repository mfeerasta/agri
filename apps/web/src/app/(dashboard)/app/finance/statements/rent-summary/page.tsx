import { db, leaseContracts, leasePayments, sharecropSettlements } from '@zameen/db';
import { and, gte, lte, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

interface SearchParams {
  from?: string;
  to?: string;
}

const TENURE_GROUPS: Array<{ key: string; label: string }> = [
  { key: 'rented_in', label: 'Rented in' },
  { key: 'rented_out', label: 'Rented out' },
  { key: 'sharecrop_in', label: 'Sharecrop in (battai)' },
  { key: 'sharecrop_out', label: 'Sharecrop out' },
  { key: 'musharka', label: 'Musharka' },
];

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export default async function RentSummaryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const sp = await searchParams;
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;

  // Payments grouped by tenure of underlying lease
  const paymentRows = await db
    .select({
      tenure: leaseContracts.tenure,
      amountPkr: leasePayments.amountPkr,
    })
    .from(leasePayments)
    .innerJoin(leaseContracts, eq(leaseContracts.id, leasePayments.leaseId))
    .where(and(gte(leasePayments.paidOn, from), lte(leasePayments.paidOn, to)));

  const settlementRows = await db
    .select({
      tenure: leaseContracts.tenure,
      landownerSharePkr: sharecropSettlements.landownerSharePkr,
      tenantSharePkr: sharecropSettlements.tenantSharePkr,
      grossRevenuePkr: sharecropSettlements.grossRevenuePkr,
    })
    .from(sharecropSettlements)
    .innerJoin(leaseContracts, eq(leaseContracts.id, sharecropSettlements.leaseId))
    .where(and(gte(sharecropSettlements.settledOn, from), lte(sharecropSettlements.settledOn, to)));

  type Bucket = { tenure: string; payments: number; settlements: number; landownerShare: number; tenantShare: number };
  const buckets = new Map<string, Bucket>();
  for (const g of TENURE_GROUPS) {
    buckets.set(g.key, { tenure: g.key, payments: 0, settlements: 0, landownerShare: 0, tenantShare: 0 });
  }
  for (const p of paymentRows) {
    const b = buckets.get(p.tenure) ?? { tenure: p.tenure, payments: 0, settlements: 0, landownerShare: 0, tenantShare: 0 };
    b.payments += Number(p.amountPkr);
    buckets.set(p.tenure, b);
  }
  for (const s of settlementRows) {
    const b = buckets.get(s.tenure) ?? { tenure: s.tenure, payments: 0, settlements: 0, landownerShare: 0, tenantShare: 0 };
    b.settlements += Number(s.grossRevenuePkr);
    b.landownerShare += Number(s.landownerSharePkr);
    b.tenantShare += Number(s.tenantSharePkr);
    buckets.set(s.tenure, b);
  }

  const fmt = (n: number) => `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-2">
      <Masthead section="Rent & sharecrop summary · کرایہ و بٹائی" />
      <SectionDivider />
      <form className="flex flex-wrap gap-2 items-end" method="get">
        <label className="text-xs">From <input type="date" name="from" defaultValue={from} className="border px-2 py-1 text-sm" /></label>
        <label className="text-xs">To <input type="date" name="to" defaultValue={to} className="border px-2 py-1 text-sm" /></label>
        <button type="submit" className="px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white">Apply</button>
      </form>

      <Card>
        <CardHeader><CardTitle>By tenure type</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Tenure</th>
                <th className="p-3">Cash payments</th>
                <th className="p-3">Gross sharecrop revenue</th>
                <th className="p-3">Landowner share</th>
                <th className="p-3">Tenant share</th>
              </tr>
            </thead>
            <tbody>
              {TENURE_GROUPS.map((g) => {
                const b = buckets.get(g.key)!;
                return (
                  <tr key={g.key} className="border-b border-[var(--rule)]">
                    <td className="p-3">{g.label}</td>
                    <td className="p-3 tabular">{fmt(b.payments)}</td>
                    <td className="p-3 tabular">{fmt(b.settlements)}</td>
                    <td className="p-3 tabular">{fmt(b.landownerShare)}</td>
                    <td className="p-3 tabular">{fmt(b.tenantShare)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="p-3">Total</td>
                <td className="p-3 tabular">{fmt(Array.from(buckets.values()).reduce((s, b) => s + b.payments, 0))}</td>
                <td className="p-3 tabular">{fmt(Array.from(buckets.values()).reduce((s, b) => s + b.settlements, 0))}</td>
                <td className="p-3 tabular">{fmt(Array.from(buckets.values()).reduce((s, b) => s + b.landownerShare, 0))}</td>
                <td className="p-3 tabular">{fmt(Array.from(buckets.values()).reduce((s, b) => s + b.tenantShare, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">Window: {from} → {to}. Ready for accounting reconciliation against land-rent cost-pool allocations.</p>
    </div>
  );
}
