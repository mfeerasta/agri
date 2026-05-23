import { Masthead, SectionDivider } from '@zameen/ui';
import { computeLossSummary } from '@zameen/finance';

export const dynamic = 'force-dynamic';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

export default async function HarvestLossesPage() {
  const summary = await computeLossSummary({});
  const totalKg = summary.reduce((s, r) => s + r.totalKg, 0);
  const totalValue = summary.reduce((s, r) => s + r.totalValuePkr, 0);
  const preventableKg = summary.reduce((s, r) => s + r.preventableKg, 0);

  // Simple inline SVG pie. Each row gets a slice proportional to totalKg.
  let cumulative = 0;
  const slices = summary.map((r, i) => {
    const ratio = totalKg > 0 ? r.totalKg / totalKg : 0;
    const startAngle = cumulative * 2 * Math.PI;
    cumulative += ratio;
    const endAngle = cumulative * 2 * Math.PI;
    const x1 = 50 + 40 * Math.sin(startAngle);
    const y1 = 50 - 40 * Math.cos(startAngle);
    const x2 = 50 + 40 * Math.sin(endAngle);
    const y2 = 50 - 40 * Math.cos(endAngle);
    const large = ratio > 0.5 ? 1 : 0;
    const d = `M50,50 L${x1.toFixed(2)},${y1.toFixed(2)} A40,40 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    return { d, color: COLORS[i % COLORS.length], label: r.lossKind, kg: r.totalKg };
  });

  return (
    <div>
      <Masthead section="CROPS / HARVEST LOSSES" />
      <SectionDivider label={`${summary.reduce((s, r) => s + r.records, 0)} loss records`} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Total loss</div>
            <div className="text-2xl">{totalKg.toFixed(0)} kg</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Total value</div>
            <div className="text-2xl">PKR {Math.round(totalValue).toLocaleString()}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Preventable share</div>
            <div className="text-2xl">{totalKg > 0 ? ((preventableKg / totalKg) * 100).toFixed(0) : '0'}%</div>
            <div className="text-xs text-slate-500">{preventableKg.toFixed(0)} kg flagged preventable</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <h3 className="text-sm uppercase tracking-wide text-slate-500 mb-2">Loss share by kind</h3>
            {totalKg > 0 ? (
              <svg viewBox="0 0 100 100" className="w-48 h-48">
                {slices.map((s, i) => (
                  <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="0.5" />
                ))}
              </svg>
            ) : (
              <div className="text-slate-500">No loss data yet.</div>
            )}
          </div>
          <div className="border rounded p-3">
            <h3 className="text-sm uppercase tracking-wide text-slate-500 mb-2">Breakdown</h3>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-2">Kind</th>
                  <th className="text-right p-2">Kg</th>
                  <th className="text-right p-2">Value</th>
                  <th className="text-right p-2">Records</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r, i) => (
                  <tr key={r.lossKind} className="border-t">
                    <td className="p-2">
                      <span className="inline-block w-3 h-3 rounded-sm mr-2 align-middle" style={{ background: COLORS[i % COLORS.length] }} />
                      {r.lossKind.replace(/_/g, ' ')}
                    </td>
                    <td className="p-2 text-right">{r.totalKg.toFixed(0)}</td>
                    <td className="p-2 text-right">{r.totalValuePkr ? Math.round(r.totalValuePkr).toLocaleString() : '—'}</td>
                    <td className="p-2 text-right">{r.records}</td>
                  </tr>
                ))}
                {summary.length === 0 ? (
                  <tr><td colSpan={4} className="p-3 text-center text-slate-500">No losses recorded.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
