import Link from 'next/link';
import { Suspense } from 'react';
import { db, leaseContracts, fields, blocks, farms } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { LeaseFilters } from '@/modules/land/components/lease-filters';

export const dynamic = 'force-dynamic';

interface SearchParams {
  tenure?: string;
  status?: string;
}

export default async function LeasesListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const sp = await searchParams;

  const rows = await db
    .select({
      id: leaseContracts.id,
      fieldId: leaseContracts.fieldId,
      fieldCode: fields.code,
      fieldName: fields.name,
      blockCode: blocks.code,
      farmName: farms.name,
      counterpartyName: leaseContracts.counterpartyName,
      tenure: leaseContracts.tenure,
      startDate: leaseContracts.startDate,
      endDate: leaseContracts.endDate,
      annualRentPkr: leaseContracts.annualRentPkr,
      sharePctLandowner: leaseContracts.sharePctLandowner,
      sharePctTenant: leaseContracts.sharePctTenant,
      status: leaseContracts.status,
    })
    .from(leaseContracts)
    .leftJoin(fields, eq(fields.id, leaseContracts.fieldId))
    .leftJoin(blocks, eq(blocks.id, fields.blockId))
    .leftJoin(farms, eq(farms.id, blocks.farmId))
    .orderBy(desc(leaseContracts.startDate));

  const filtered = rows.filter((r) => {
    if (sp.tenure && sp.tenure !== 'all' && r.tenure !== sp.tenure) return false;
    if (sp.status && sp.status !== 'all' && r.status !== sp.status) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      <Masthead section="Leases · زمین کے معاہدے" />
      <SectionDivider />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Suspense fallback={null}>
          <LeaseFilters currentTenure={sp.tenure ?? 'all'} currentStatus={sp.status ?? 'all'} />
        </Suspense>
        <Link
          href={'/land/leases/new' as never}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 min-h-[44px] md:min-h-[40px] inline-flex items-center"
        >
          New lease · نیا
        </Link>
      </div>

      <SectionDivider label="All leases" />
      {filtered.length === 0 ? (
        <EmptyState title="No leases on file" caption="Add a lease to track rent, share, and deeds." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Field</th>
                    <th className="p-3">Counterparty</th>
                    <th className="p-3">Tenure</th>
                    <th className="p-3">Period</th>
                    <th className="p-3">Rent / share</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--rule)] hover:bg-slate-50">
                      <td className="p-3 md:py-2 font-semibold">
                        <Link href={`/land/leases/${r.id}` as never}>{r.fieldCode ?? '—'}</Link>
                        <div className="text-xs text-slate-500">{r.farmName}{r.blockCode ? ` / ${r.blockCode}` : ''}</div>
                      </td>
                      <td className="p-3 md:py-2">{r.counterpartyName}</td>
                      <td className="p-3 md:py-2">{r.tenure.replace(/_/g, ' ')}</td>
                      <td className="p-3 md:py-2 tabular text-xs">
                        {String(r.startDate)}<br />
                        {r.endDate ? `→ ${String(r.endDate)}` : '→ open'}
                      </td>
                      <td className="p-3 md:py-2 tabular">
                        {r.annualRentPkr
                          ? `PKR ${Number(r.annualRentPkr).toLocaleString('en-PK')}/yr`
                          : r.sharePctLandowner
                            ? `${r.sharePctLandowner}% LO / ${r.sharePctTenant}% T`
                            : '—'}
                      </td>
                      <td className="p-3 md:py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            r.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'disputed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
