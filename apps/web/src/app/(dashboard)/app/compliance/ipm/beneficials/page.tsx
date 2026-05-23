import { desc } from 'drizzle-orm';
import { db, beneficialInsectLogs } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { listFieldOptions } from '@/modules/compliance/scouting-actions';
import { BeneficialsClient } from '@/modules/compliance/beneficials-client';

export const dynamic = 'force-dynamic';

export default async function BeneficialsPage() {
  const [rows, fieldOptions] = await Promise.all([
    db.select().from(beneficialInsectLogs).orderBy(desc(beneficialInsectLogs.observedAt)).limit(50),
    listFieldOptions(),
  ]);

  return (
    <div>
      <Masthead section="BENEFICIAL INSECTS" />
      <SectionDivider />
      <p className="mb-4 text-sm text-[var(--ink)]/70">
        High beneficial counts + moderate pest counts means natural control is working. Avoid broad-spectrum sprays that destroy this balance.
      </p>

      <div className="grid lg:grid-cols-2 gap-4">
        <BeneficialsClient fieldOptions={fieldOptions} />

        <Card>
          <CardHeader><CardTitle>Recent logs</CardTitle></CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="p-6 text-sm text-[var(--ink)]/50">No beneficial-insect logs yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Species</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Count</th>
                </tr></thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 tabular text-xs">{fmtDate(b.observedAt)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.fieldId.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-xs">{b.species}</td>
                      <td className="px-3 py-2 text-right tabular text-xs">{b.countEstimate ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
