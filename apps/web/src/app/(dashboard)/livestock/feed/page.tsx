import Link from 'next/link';
import { Masthead, SectionDivider, EmptyState, Pkr } from '@zameen/ui';
import { db, feedRecords } from '@zameen/db';
import { desc } from 'drizzle-orm';

export default async function FeedListPage() {
  const rows = await db.select().from(feedRecords).orderBy(desc(feedRecords.recordedOn)).limit(100);
  return (
    <div className="space-y-6">
      <Masthead section="Livestock / Feed" />
      <div className="flex justify-end">
        <Link href={'/livestock/feed/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white">Log feed</Link>
      </div>
      <SectionDivider />
      {rows.length === 0 ? <EmptyState title="No feed records" body="Log your first feed entry." /> : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr><th className="p-3">Date</th><th className="p-3">Target</th><th className="p-3">Total cost</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.recordedOn}</td>
                  <td className="p-3">{r.animalId ?? r.groupKey ?? '-'}</td>
                  <td className="p-3"><Pkr value={r.totalCostPkr} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
