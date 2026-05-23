import Link from 'next/link';
import { db, vendors } from '@zameen/db';
import { asc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { computeVendorScores } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function chip(label: string, value: number, suffix = '%'): React.JSX.Element {
  let color = 'var(--ink)';
  if (value >= 85) color = 'var(--success)';
  else if (value >= 70) color = 'var(--warning)';
  else if (value > 0) color = 'var(--danger)';
  return (
    <span
      className="inline-block border px-1.5 py-0.5 smallcaps text-[0.6rem] tabular"
      style={{ borderColor: color, color }}
    >
      {label} {value.toFixed(0)}{suffix}
    </span>
  );
}

export default async function VendorsPage() {
  const ctx = await getSessionContext();
  const rows = ctx
    ? await db.select().from(vendors).where(eq(vendors.entityId, ctx.entityId)).orderBy(asc(vendors.name))
    : await db.select().from(vendors).orderBy(asc(vendors.name));
  const scores = ctx ? await computeVendorScores(ctx.entityId) : [];
  const byId = new Map(scores.map((s) => [s.vendorId, s]));
  return (
    <div>
      <Masthead section="VENDORS" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">{rows.length} vendors</div>
        <Link
          href={'/procurement/vendors/new' as never}
          className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
        >
          Add vendor
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All vendors</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No vendors yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Code</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Scorecard</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Credit days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const s = byId.get(v.id);
                  return (
                    <tr key={v.id} className="border-t border-[var(--rule)] hover:bg-[var(--paper-2)]">
                      <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                      <td className="px-3 py-2">
                        <Link href={`/procurement/vendors/${v.id}` as never} className="underline">
                          {v.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{v.category ?? '—'}</td>
                      <td className="px-3 py-2 space-x-1">
                        {s ? (
                          <>
                            {chip('on-time', s.onTimeDeliveryPct)}
                            {chip('acc', s.avgQuoteAccuracyPct)}
                            {chip('qc-fail', s.qcFailRate)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular">{v.creditTermsDays}</td>
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
