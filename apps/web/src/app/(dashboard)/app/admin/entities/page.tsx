import { db, entities } from '@zameen/db';
import { asc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function EntitiesAdminPage() {
  const rows = await db.select().from(entities).orderBy(asc(entities.name));
  return (
    <div>
      <Masthead section="ENTITIES" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>{rows.length} entities</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No entities.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Code</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Legal name</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
              </tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{e.code}</td>
                    <td className="px-3 py-2">{e.name}</td>
                    <td className="px-3 py-2 text-[0.85rem] text-[var(--ink)]/70">{e.legalName ?? '—'}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{e.kind}</td>
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
