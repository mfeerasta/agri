import Link from 'next/link';
import { db, vendors } from '@zameen/db';
import { asc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const rows = await db.select().from(vendors).orderBy(asc(vendors.name));
  return (
    <div>
      <Masthead section="VENDORS" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">{rows.length} vendors</div>
        <Link href={'/procurement/vendors/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Add vendor</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>All vendors</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No vendors yet.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Code</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Phone</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Credit days</th>
              </tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                    <td className="px-3 py-2">{v.name}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{v.category ?? '—'}</td>
                    <td className="px-3 py-2 tabular text-xs">{v.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular">{v.creditTermsDays}</td>
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
