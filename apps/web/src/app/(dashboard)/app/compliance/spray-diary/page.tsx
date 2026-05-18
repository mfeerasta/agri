import { db, sprayDiaries } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SprayDiaryPage() {
  const rows = await db.select().from(sprayDiaries).orderBy(desc(sprayDiaries.sprayedOn)).limit(100);
  return (
    <div>
      <Masthead section="SPRAY DIARY" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Pesticide applications</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No sprays logged.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Pesticide</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">L/acre</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">PHI</th>
              </tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(s.sprayedOn)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.fieldId.slice(0, 8)}</td>
                    <td className="px-3 py-2">{s.pesticideName}</td>
                    <td className="px-3 py-2 text-right tabular">{s.doseLitresPerAcre ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular">{s.preHarvestIntervalDays ?? '—'}</td>
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
