import { db, buyers } from '@zameen/db';
import { asc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function BuyersPage() {
  const rows = await db.select().from(buyers).orderBy(asc(buyers.name));
  return (
    <div>
      <Masthead section="BUYERS" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>{rows.length} buyers</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No buyers yet.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Code</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Phone</th>
              </tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{b.code}</td>
                    <td className="px-3 py-2"><a className="underline" href={`/app/sales/buyers/${b.id}`}>{b.name}</a></td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{b.category}</td>
                    <td className="px-3 py-2 tabular text-xs">{b.phone ?? '—'}</td>
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
