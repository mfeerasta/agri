import { db, accounts } from '@zameen/db';
import { asc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const rows = await db.select().from(accounts).orderBy(asc(accounts.code));
  const byType = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.accountType] ??= []).push(r);
    return acc;
  }, {});
  return (
    <div>
      <Masthead section="CHART OF ACCOUNTS" />
      <SectionDivider />
      <div className="space-y-6">
        {Object.entries(byType).map(([type, list]) => (
          <Card key={type}>
            <CardHeader><CardTitle className="capitalize">{type}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                  <tr>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Code</th>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Cost pool</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem] text-[var(--ink)]/60">{a.costPool ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
