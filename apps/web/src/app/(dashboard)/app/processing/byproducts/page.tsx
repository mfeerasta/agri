/**
 * Byproduct disposition tracker: open lots, dispose with proceeds.
 */
import { listOpenByproducts } from '@/modules/processing/actions';
import { getSessionContext } from '@/lib/session';
import { DisposeRow } from '@/modules/processing/components/dispose-row';

export const dynamic = 'force-dynamic';

export default async function ByproductsPage() {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view byproducts.</div>;
  const rows = await listOpenByproducts();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Byproduct dispositions</h1>
        <p className="text-sm text-slate-500">
          Husk, bran, bagasse, buttermilk: track sale, livestock feed, compost, or disposal.
        </p>
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Booked value</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Dispose</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No open byproducts. They appear here after a processing run.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <DisposeRow key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
