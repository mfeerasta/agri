import Link from 'next/link';
import { desc, eq, sum, and } from 'drizzle-orm';
import { db, insurancePolicies, insuranceClaims } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InsuranceHomePage() {
  const policies = await db.select().from(insurancePolicies).orderBy(desc(insurancePolicies.createdAt));
  const policyIds = policies.map((p) => p.id);
  const claims = policyIds.length
    ? await db.select().from(insuranceClaims)
    : [];

  const totalCoverage = policies.filter((p) => p.status === 'active').reduce((s, p) => s + Number(p.coveragePkr), 0);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const premiumYtd = policies
    .filter((p) => new Date(p.createdAt) >= yearStart)
    .reduce((s, p) => s + Number(p.premiumPkr), 0);
  const filed = claims.length;
  const paid = claims.filter((c) => c.status === 'paid').length;

  return (
    <div className="space-y-3">
      <Masthead section="INSURANCE" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Active coverage" value={<Pkr value={totalCoverage} />} />
        <StatBlock label="Premium YTD" value={<Pkr value={premiumYtd} />} />
        <StatBlock label="Claims filed" value={String(filed)} />
        <StatBlock label="Claims paid" value={String(paid)} />
      </div>
      <div className="flex justify-end">
        <Link href={'/compliance/insurance/policies/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">+ New policy</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Policies</CardTitle></CardHeader>
        <CardContent className="p-0">
          {policies.length === 0 ? (
            <EmptyState title="No insurance policies yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Policy #</th>
                  <th className="p-3">Insurer</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3 text-right">Coverage</th>
                  <th className="p-3 text-right">Premium</th>
                  <th className="p-3">Effective</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">
                      <Link href={`/compliance/insurance/policies/${p.id}` as never} className="font-semibold">{p.policyNumber}</Link>
                    </td>
                    <td className="p-3">{p.insurerName}</td>
                    <td className="p-3 uppercase smallcaps text-[0.7rem]">{p.policyKind}</td>
                    <td className="p-3 text-right"><Pkr value={p.coveragePkr} /></td>
                    <td className="p-3 text-right"><Pkr value={p.premiumPkr} /></td>
                    <td className="p-3 tabular text-xs">{fmtDate(p.effectiveFrom)} to {fmtDate(p.effectiveTo)}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{p.status}</td>
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
