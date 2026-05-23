import Link from 'next/link';
import { Masthead, SectionDivider } from '@zameen/ui';
import { topRecommendationPerField } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DecisionSupportHubPage() {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const rows = await topRecommendationPerField();

  const actionColor: Record<string, string> = {
    spray: 'bg-amber-50 border-amber-300',
    fertilize: 'bg-emerald-50 border-emerald-300',
    harvest: 'bg-rose-50 border-rose-300',
    replant: 'bg-orange-50 border-orange-300',
    observe: 'bg-slate-50 border-slate-200',
  };

  return (
    <div>
      <Masthead section="CROPS / DECISION SUPPORT" />
      <SectionDivider label={`${rows.length} fields analysed`} />
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-600">
          Top agronomic recommendation per active field. Drill into spray timing, nutrient plans, or harvest readiness.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <div
              key={r.fieldId}
              className={`border rounded p-4 ${actionColor[r.topAction] ?? actionColor.observe}`}
            >
              <div className="text-xs uppercase tracking-wide text-slate-600">
                {r.cropCode ?? 'no crop'} - {r.stage ?? 'unknown stage'}
              </div>
              <div className="text-lg font-medium">{r.fieldName}</div>
              <div className="text-sm mt-1">{r.headline}</div>
              <div className="flex gap-2 mt-3 text-xs">
                <Link
                  href={`/crops/decision-support/spray/${r.fieldId}` as never}
                  className="px-2 py-1 border rounded bg-white"
                >
                  Spray
                </Link>
                <Link
                  href={`/crops/decision-support/nutrients/${r.fieldId}` as never}
                  className="px-2 py-1 border rounded bg-white"
                >
                  Nutrients
                </Link>
                <Link
                  href={`/crops/decision-support/harvest/${r.fieldId}` as never}
                  className="px-2 py-1 border rounded bg-white"
                >
                  Harvest
                </Link>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="border rounded p-4 text-slate-500 col-span-full">
              No fields configured. Add a field to begin.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
