import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadAnomalies } from '@/modules/inventory/forecast-actions';
import { ResolveAnomalyForm, ScanAnomaliesButton } from '@/modules/inventory/forecasts-controls';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  unusual_high_usage: 'High usage',
  unusual_low_usage: 'Low usage',
  stockout: 'Stockout',
  expired_unused: 'Expired unused',
  batch_mismatch: 'Batch mismatch',
  reconciliation_variance: 'Recon variance',
};

export default async function AnomaliesPage() {
  const ctx = await getSessionContext();
  if (!ctx?.entityId) return <EmptyState title="No entity context" />;
  const rows = await loadAnomalies({ entityId: ctx.entityId, includeResolved: false });

  return (
    <div className="space-y-2">
      <Masthead section="INVENTORY ANOMALIES" />
      <SectionDivider />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              title="No open anomalies"
              description="Anomalies are detected nightly. You can also scan a single input manually from the forecasts page."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Detected</th>
                  <th className="p-3">Input</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3">Observed</th>
                  <th className="p-3">Expected</th>
                  <th className="p-3">Sigma</th>
                  <th className="p-3">Investigate</th>
                  <th className="p-3">Resolve</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--rule)] align-top">
                    <td className="p-3 tabular">{r.detectedOn}</td>
                    <td className="p-3">
                      {r.inputName} <span className="text-xs text-slate-500">({r.unit})</span>
                    </td>
                    <td className="p-3">{KIND_LABEL[r.anomalyKind] ?? r.anomalyKind}</td>
                    <td className="p-3 tabular">{r.observedQuantity.toFixed(2)}</td>
                    <td className="p-3 tabular">{r.expectedQuantity.toFixed(2)}</td>
                    <td className="p-3 tabular">{r.stdDevAway.toFixed(2)}</td>
                    <td className="p-3">
                      <ScanAnomaliesButton inputId={r.inputId} />
                    </td>
                    <td className="p-3">
                      <ResolveAnomalyForm anomalyId={r.id} />
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
