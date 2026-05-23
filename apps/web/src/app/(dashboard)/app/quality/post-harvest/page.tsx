import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listPostHarvestEvents } from '@/modules/quality/actions';

export const dynamic = 'force-dynamic';

export default async function PostHarvestPage() {
  const ctx = await getSessionContext();
  const rows = ctx?.entityId ? await listPostHarvestEvents(ctx.entityId) : [];

  return (
    <div className="space-y-2">
      <Masthead section="Post-harvest events" />
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>Cleaning, drying, grading log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-2">
            Each event auto-allocates cost to the post_harvest pool against the lot field and crop plan.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">Date</th>
                  <th>Lot</th>
                  <th>Crop</th>
                  <th>Event</th>
                  <th>Input kg</th>
                  <th>Output kg</th>
                  <th>Shrink %</th>
                  <th>Cost PKR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{r.occurredOn}</td>
                    <td>{r.lotNumber}</td>
                    <td>{r.cropName}</td>
                    <td>{r.eventKind}</td>
                    <td>{r.inputQuantityKg ?? '-'}</td>
                    <td>{r.outputQuantityKg ?? '-'}</td>
                    <td>{r.shrinkagePct ?? '-'}</td>
                    <td>{r.costPkr ? Number(r.costPkr).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-slate-400">
                      No events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
