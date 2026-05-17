import { db, arhtis } from '@zameen/db';
import { asc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function ArhtisPage() {
  const rows = await db.select().from(arhtis).orderBy(asc(arhtis.name));
  return (
    <div>
      <Masthead section="ARHTIS" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>{rows.length} commission agents</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No arhtis yet.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Mandi</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Commission %</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Phone</th>
              </tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 text-[0.85rem]">{a.mandiLocation ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular">{a.commissionPct ?? '—'}</td>
                    <td className="px-3 py-2 tabular text-xs">{a.phone ?? '—'}</td>
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
