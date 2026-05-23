import { Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import {
  listScoutingForField,
  listBeneficialsForField,
  computeBeneficialRatio,
} from './scouting-actions';

function severityColor(s: number): string {
  if (s >= 5) return 'bg-red-700 text-white';
  if (s === 4) return 'bg-red-500 text-white';
  if (s === 3) return 'bg-amber-500';
  if (s === 2) return 'bg-yellow-300';
  return 'bg-emerald-300';
}

/**
 * Renders recent scouting + beneficial context for a field, plus the IPM
 * "soft chemistry" warning when natural enemies are present. Server component;
 * the planner page passes a focus fieldId via query string.
 */
export async function ScoutingContextPanel({ fieldId }: { fieldId: string }) {
  const [obs, benes, ratio] = await Promise.all([
    listScoutingForField(fieldId, 14),
    listBeneficialsForField(fieldId, 14),
    computeBeneficialRatio(fieldId, 14),
  ]);

  const highBeneficials = ratio >= 0.5 && benes.length > 0;

  return (
    <div className="space-y-3 mb-4">
      {highBeneficials ? (
        <Card className="border-emerald-600">
          <CardContent className="p-3 text-sm">
            <strong className="text-emerald-700">High beneficial activity detected.</strong>{' '}
            Ratio {ratio.toFixed(2)}. Avoid broad-spectrum insecticides (synthetic pyrethroids,
            organophosphates). Prefer selective options: pyriproxyfen, buprofezin, spinosad,
            chlorantraniliprole, or Bt sprays.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Recent scouting on this field (14d)</CardTitle></CardHeader>
        <CardContent className="p-3">
          {obs.length === 0 ? (
            <div className="text-sm text-[var(--ink)]/50">No scouting observations in the last 14 days.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-2 py-1 text-[0.65rem]">Date</th>
                <th className="smallcaps text-left px-2 py-1 text-[0.65rem]">Pest</th>
                <th className="smallcaps text-right px-2 py-1 text-[0.65rem]">Sev</th>
                <th className="smallcaps text-right px-2 py-1 text-[0.65rem]">Prev%</th>
                <th className="smallcaps text-left px-2 py-1 text-[0.65rem]">Action</th>
              </tr></thead>
              <tbody>
                {obs.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--rule)]">
                    <td className="px-2 py-1 tabular text-xs">{new Date(o.observedAt).toISOString().slice(0, 10)}</td>
                    <td className="px-2 py-1 text-xs">{o.pestOrDisease}</td>
                    <td className="px-2 py-1 text-right">
                      <span className={`inline-block w-6 text-center ${severityColor(o.severity)}`}>{o.severity}</span>
                    </td>
                    <td className="px-2 py-1 text-right tabular text-xs">{o.prevalencePct ?? ''}</td>
                    <td className="px-2 py-1 text-xs">{o.recommendedAction ? o.recommendedAction.slice(0, 60) + '…' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {benes.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Beneficial insects logged (14d)</CardTitle></CardHeader>
          <CardContent className="p-3 text-sm">
            <div className="flex gap-2 flex-wrap">
              {benes.slice(0, 10).map((b) => (
                <span key={b.id} className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs">
                  {b.species}{b.countEstimate ? ` ×${b.countEstimate}` : ''}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
