import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, scoutingObservations } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { scoutingCalendar } from '@/modules/compliance/scouting-actions';

export const dynamic = 'force-dynamic';

function severityColor(s: number): string {
  if (s >= 5) return 'bg-red-700';
  if (s === 4) return 'bg-red-500';
  if (s === 3) return 'bg-amber-500';
  if (s === 2) return 'bg-yellow-300';
  return 'bg-emerald-300';
}

export default async function ScoutingHubPage() {
  const recent = await db
    .select()
    .from(scoutingObservations)
    .orderBy(desc(scoutingObservations.observedAt))
    .limit(60);

  const cal = await scoutingCalendar(30);
  // Aggregate max severity per day for the calendar strip.
  const byDay = new Map<string, number>();
  for (const r of cal) {
    const prev = byDay.get(r.day) ?? 0;
    if (r.severity > prev) byDay.set(r.day, r.severity);
  }

  // Build last 30 days (oldest to newest)
  const today = new Date();
  const days: { iso: string; sev: number }[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ iso, sev: byDay.get(iso) ?? 0 });
  }

  return (
    <div>
      <Masthead section="SCOUTING" />
      <SectionDivider />

      <div className="flex gap-3 mb-4">
        <Link href="/compliance/scouting/new" className="px-3 py-2 bg-[var(--ink)] text-[var(--paper)] text-sm smallcaps">New observation</Link>
        <Link href="/compliance/scouting/heatmap" className="px-3 py-2 border border-[var(--rule)] text-sm smallcaps">Field heatmap</Link>
        <Link href="/compliance/ipm/thresholds" className="px-3 py-2 border border-[var(--rule)] text-sm smallcaps">Action thresholds</Link>
        <Link href="/compliance/ipm/beneficials" className="px-3 py-2 border border-[var(--rule)] text-sm smallcaps">Beneficials</Link>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>Severity calendar (30d, max per day)</CardTitle></CardHeader>
        <CardContent className="p-3">
          <div className="flex gap-1 overflow-x-auto">
            {days.map((d) => (
              <div key={d.iso} className="flex flex-col items-center" style={{ width: 28 }}>
                <div className={`w-6 h-6 ${d.sev > 0 ? severityColor(d.sev) : 'bg-[var(--paper-2)] border border-[var(--rule)]'}`} title={`${d.iso} severity ${d.sev}`} />
                <div className="tabular text-[0.55rem] mt-1">{d.iso.slice(5)}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3 text-[0.65rem] smallcaps">
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-300 inline-block" /> 1</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-300 inline-block" /> 2</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-500 inline-block" /> 3</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 inline-block" /> 4</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-700 inline-block" /> 5</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent observations</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No observations yet. Log one to get started.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Pest/Disease</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Severity</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Prev %</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Action</th>
              </tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(o.observedAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{o.fieldId.slice(0, 8)}</td>
                    <td className="px-3 py-2">{o.pestOrDisease}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-block w-6 text-center text-white ${severityColor(o.severity)}`}>{o.severity}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{o.prevalencePct ?? ''}</td>
                    <td className="px-3 py-2 text-xs text-[var(--ink)]/70">{o.recommendedAction ? o.recommendedAction.slice(0, 80) + (o.recommendedAction.length > 80 ? '…' : '') : ''}</td>
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
