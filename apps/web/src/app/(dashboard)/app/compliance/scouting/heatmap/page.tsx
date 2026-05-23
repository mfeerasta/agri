import Link from 'next/link';
import { gte, desc } from 'drizzle-orm';
import { db, scoutingObservations, fields } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

function severityColor(s: number): string {
  if (s >= 5) return 'bg-red-700';
  if (s === 4) return 'bg-red-500';
  if (s === 3) return 'bg-amber-500';
  if (s === 2) return 'bg-yellow-300';
  return 'bg-emerald-300';
}

export default async function ScoutingHeatmapPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const obs = await db
    .select()
    .from(scoutingObservations)
    .where(gte(scoutingObservations.observedAt, since))
    .orderBy(desc(scoutingObservations.observedAt));

  const allFields = await db.select({ id: fields.id, code: fields.code, name: fields.name, acres: fields.acres }).from(fields);

  // Group by field. For each field compute max severity and obs count.
  const byField = new Map<string, { count: number; maxSev: number; pests: Set<string>; latest?: Date }>();
  for (const o of obs) {
    const agg = byField.get(o.fieldId) ?? { count: 0, maxSev: 0, pests: new Set<string>() };
    agg.count += 1;
    if (o.severity > agg.maxSev) agg.maxSev = o.severity;
    agg.pests.add(o.pestOrDisease);
    if (!agg.latest || o.observedAt > agg.latest) agg.latest = o.observedAt;
    byField.set(o.fieldId, agg);
  }

  const ranked = allFields
    .map((f) => ({ ...f, agg: byField.get(f.id) ?? { count: 0, maxSev: 0, pests: new Set<string>() } }))
    .sort((a, b) => b.agg.maxSev - a.agg.maxSev || b.agg.count - a.agg.count);

  return (
    <div>
      <Masthead section="SCOUTING HEATMAP" />
      <SectionDivider />

      <div className="mb-3 text-sm text-[var(--ink)]/60">Last 30 days. Color shows max severity per field.</div>

      <Card>
        <CardHeader><CardTitle>Field severity grid</CardTitle></CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
            {ranked.map((f) => (
              <Link
                key={f.id}
                href={`/compliance/scouting?field=${f.id}`}
                className={`block p-3 border border-[var(--rule)] ${f.agg.maxSev > 0 ? severityColor(f.agg.maxSev) + ' text-white' : 'bg-[var(--paper-2)]'}`}
              >
                <div className="text-xs font-mono">{f.code}</div>
                {f.name ? <div className="text-xs mt-1">{f.name}</div> : null}
                <div className="tabular text-[0.7rem] mt-2">
                  {f.agg.count} obs · max sev {f.agg.maxSev || '-'}
                </div>
                {f.agg.pests.size > 0 ? (
                  <div className="text-[0.65rem] mt-1 line-clamp-2">{Array.from(f.agg.pests).join(', ')}</div>
                ) : null}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Observations (last 30d)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {obs.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No observations in window.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Pest</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Sev</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Prev%</th>
              </tr></thead>
              <tbody>
                {obs.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(o.observedAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{o.fieldId.slice(0, 8)}</td>
                    <td className="px-3 py-2">{o.pestOrDisease}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-block w-6 text-center text-white ${severityColor(o.severity)}`}>{o.severity}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{o.prevalencePct ?? ''}</td>
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
