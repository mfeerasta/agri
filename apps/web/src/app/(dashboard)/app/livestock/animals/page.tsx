import Link from 'next/link';
import { Masthead, SectionDivider, EmptyState } from '@zameen/ui';
import { db, animals } from '@zameen/db';
import { desc } from 'drizzle-orm';

export default async function AnimalsListPage() {
  const rows = await db.select().from(animals).orderBy(desc(animals.earTag)).limit(200);
  return (
    <div className="space-y-6">
      <Masthead section="Livestock / Animals" />
      <div className="flex justify-end">
        <Link href={'/livestock/animals/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-white">Register animal</Link>
      </div>
      <SectionDivider />
      {rows.length === 0 ? (
        <EmptyState title="No animals" body="Register your first animal to begin." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Ear tag</th><th className="p-3">Species</th><th className="p-3">Breed</th>
                <th className="p-3">Sex</th><th className="p-3">DOB</th><th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3"><Link href={`/livestock/animals/${a.id}` as never} className="text-emerald-700 underline">{a.earTag}</Link></td>
                  <td className="p-3">{a.species}</td>
                  <td className="p-3">{a.breed ?? '—'}</td>
                  <td className="p-3">{a.sex}</td>
                  <td className="p-3">{a.dob ?? '—'}</td>
                  <td className="p-3">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
