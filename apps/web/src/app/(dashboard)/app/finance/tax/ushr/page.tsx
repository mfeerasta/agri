import { db, ushrSettlements } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UshrPage() {
  const rows = await db.select().from(ushrSettlements).orderBy(desc(ushrSettlements.createdAt)).limit(300);
  const totalKg = rows.reduce((a, r) => a + Number(r.ushrKg), 0);
  const totalValue = rows.reduce((a, r) => a + Number(r.ushrValuePkr ?? 0), 0);
  const settled = rows.filter((r) => r.settledOn).length;

  return (
    <div>
      <Masthead section="USHR SETTLEMENTS" />
      <SectionDivider />
      <div className="mb-3 grid grid-cols-3 gap-3 text-xs">
        <Card><CardContent><div className="smallcaps text-[var(--ink)]/60">Records</div><div className="text-lg">{rows.length}</div></CardContent></Card>
        <Card><CardContent><div className="smallcaps text-[var(--ink)]/60">Total ushr (kg)</div><div className="tabular text-lg">{totalKg.toLocaleString('en-PK')}</div></CardContent></Card>
        <Card><CardContent><div className="smallcaps text-[var(--ink)]/60">Settled / Outstanding</div><div className="tabular text-lg">{settled} / {rows.length - settled}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Per harvest</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">Auto-generates when harvest records are inserted.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Mode</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Gross (kg)</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Rate</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Ushr (kg)</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Value</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Settled</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Paid to</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Form</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.fieldId.slice(0, 8)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.irrigated ? 'Irrigated' : 'Rain-fed'}</td>
                    <td className="px-3 py-2 text-right tabular">{Number(r.grossProduceKg).toLocaleString('en-PK')}</td>
                    <td className="px-3 py-2 text-right tabular">{r.ushrRatePct}%</td>
                    <td className="px-3 py-2 text-right tabular">{Number(r.ushrKg).toLocaleString('en-PK')}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.ushrValuePkr ?? 0} /></td>
                    <td className="px-3 py-2 tabular text-xs">{r.settledOn ? fmtDate(r.settledOn) : '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.paidTo ?? '—'}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.paidInKind ? 'In kind' : 'Cash'}</td>
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
