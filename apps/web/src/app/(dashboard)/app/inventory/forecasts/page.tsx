import Link from 'next/link';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadForecasts } from '@/modules/inventory/forecast-actions';
import { RecomputeButton } from '@/modules/inventory/forecasts-controls';

export const dynamic = 'force-dynamic';

function ragBadge(rag: 'red' | 'amber' | 'green', days: number | null): JSX.Element {
  const cls =
    rag === 'red'
      ? 'bg-red-100 text-red-800'
      : rag === 'amber'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-100 text-emerald-800';
  const label = days == null ? 'no demand' : `${days}d`;
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

export default async function InventoryForecastsPage() {
  const ctx = await getSessionContext();
  if (!ctx?.entityId) {
    return <EmptyState title="No entity context" />;
  }
  const rows = await loadForecasts(ctx.entityId);

  return (
    <div className="space-y-2">
      <Masthead section="INVENTORY FORECASTS" />
      <SectionDivider />
      <div className="flex justify-end gap-2">
        <Link
          href={'/inventory/reorder-rules' as never}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white"
        >
          Reorder rules
        </Link>
        <Link
          href={'/inventory/anomalies' as never}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm text-white"
        >
          Anomalies
        </Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              title="No forecasts yet"
              description="Forecasts are computed nightly. Add a reorder rule or recompute manually."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Input</th>
                  <th className="p-3">On hand</th>
                  <th className="p-3">Daily velocity</th>
                  <th className="p-3">Days to stockout</th>
                  <th className="p-3">Reorder qty</th>
                  <th className="p-3">Reorder by</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.inputId} className="border-b border-[var(--rule)]">
                    <td className="p-3">
                      {r.inputName}
                      {r.inputNameUr ? (
                        <span dir="rtl" className="ml-2 text-xs text-slate-500">
                          {r.inputNameUr}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3 tabular">
                      {r.currentStock.toFixed(2)} {r.unit}
                    </td>
                    <td className="p-3 tabular">
                      {r.dailyVelocity.toFixed(3)} {r.unit}/d
                    </td>
                    <td className="p-3 tabular">{ragBadge(r.rag, r.daysUntilStockout)}</td>
                    <td className="p-3 tabular">
                      {r.recommendedReorderQuantity.toFixed(2)} {r.unit}
                    </td>
                    <td className="p-3 tabular">{r.recommendedReorderByDate ?? ''}</td>
                    <td className="p-3">
                      <RecomputeButton inputId={r.inputId} />
                    </td>
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
