import { db, storageLocations } from '@zameen/db';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function StorageLocationsPage() {
  const rows = await db.select().from(storageLocations).orderBy(storageLocations.code);
  return (
    <div className="space-y-2">
      <Masthead section="STORAGE LOCATIONS" />
      <SectionDivider />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="No storage locations" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Code</th><th className="p-3">Name</th><th className="p-3">Kind</th><th className="p-3">Capacity (kg)</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 font-semibold">{r.code}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{r.kind}</td>
                    <td className="p-3 tabular">{r.capacityKg ?? ''}</td>
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
