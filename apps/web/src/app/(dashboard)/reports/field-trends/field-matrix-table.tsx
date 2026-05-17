import Link from 'next/link';
import type { FieldMatrix } from '@/lib/reports/field-matrix';
import { fmtNumber } from '@/lib/format';

export interface FieldMatrixTableProps {
  matrix: FieldMatrix;
}

function colorFor(value: number, scaleMax: number): string {
  if (value < 0) return 'bg-[var(--danger)]/25 text-[var(--danger)]';
  if (scaleMax <= 0) return 'bg-[var(--surface-2)]';
  const ratio = Math.min(1, value / scaleMax);
  if (ratio < 0.33) return 'bg-amber-200/50';
  if (ratio < 0.66) return 'bg-emerald-200/50';
  return 'bg-emerald-400/50';
}

export function FieldMatrixTable({ matrix }: FieldMatrixTableProps) {
  const allCells = matrix.rows.flatMap((r) => Object.values(r.cells).filter((c): c is NonNullable<typeof c> => c !== null));
  const scaleMax = allCells.length > 0 ? Math.max(...allCells.map((c) => c.marginPerAcre)) : 0;

  if (matrix.rows.length === 0) {
    return <div className="p-6 text-sm text-[var(--ink)]/50">No crop plans recorded yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
          <tr>
            <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
            <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Acres</th>
            {matrix.seasons.map((s) => (
              <th key={s} className="smallcaps text-right px-3 py-2 text-[0.7rem]">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.fieldId} className="border-t border-[var(--rule)]">
              <td className="px-3 py-2 font-mono text-xs">{r.fieldCode}</td>
              <td className="px-3 py-2 text-right tabular text-[var(--ink)]/60">{r.acres.toFixed(1)}</td>
              {matrix.seasons.map((s) => {
                const cell = r.cells[s];
                if (!cell) {
                  return (
                    <td key={s} className="px-3 py-2 text-right text-[var(--ink)]/30">—</td>
                  );
                }
                return (
                  <td key={s} className={`px-3 py-2 text-right ${colorFor(cell.marginPerAcre, scaleMax)}`}>
                    <Link
                      href={`/finance/field-pnl?cropPlanId=${cell.cropPlanId}`}
                      className="block hover:underline"
                      title={`${cell.cropName} · yield/acre ${fmtNumber(cell.yieldPerAcre, 0)} kg`}
                    >
                      <span className="tabular text-xs">{fmtNumber(cell.marginPerAcre, 0)}</span>
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[0.65rem] text-[var(--ink)]/50 smallcaps">
        margin / acre PKR — red &lt; 0, amber low, green high. Click a cell to open crop plan.
      </div>
    </div>
  );
}
