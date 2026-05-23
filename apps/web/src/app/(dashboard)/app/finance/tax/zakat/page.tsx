import { db, zakatAssessments } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { computeZakat } from '@zameen/finance';
import { newZakatAssessment } from '@/lib/finance/tax-actions';

export const dynamic = 'force-dynamic';

export default async function ZakatPage() {
  const rows = await db.select().from(zakatAssessments).orderBy(desc(zakatAssessments.assessmentDate)).limit(50);
  // Preview line for the new-assessment card: shows what current input would compute.
  const previewInput = { nisabPkr: 0, cashPkr: 0, bankBalancesPkr: 0, receivablesPkr: 0, inventoryValuePkr: 0, liquidLivestockValuePkr: 0, debtsOwedPkr: 0 };
  const preview = computeZakat(previewInput);

  return (
    <div>
      <Masthead section="ZAKAT ASSESSMENT" />
      <SectionDivider label="New annual assessment (Hijri year-end)" />
      <Card>
        <CardContent>
          <form action={newZakatAssessment} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Assessment date</span>
              <input name="assessmentDate" type="date" required className="w-full border rounded px-2 py-1 text-sm" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Hijri year</span>
              <input name="hijriYear" type="number" required className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Nisab (PKR, current gold rate)</span>
              <input name="nisabPkr" type="number" step="0.01" required className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Cash PKR</span>
              <input name="cashPkr" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Bank balances PKR</span>
              <input name="bankBalancesPkr" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Receivables PKR</span>
              <input name="receivablesPkr" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Inventory value PKR</span>
              <input name="inventoryValuePkr" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Liquid livestock value PKR</span>
              <input name="liquidLivestockValuePkr" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Debts owed PKR</span>
              <input name="debtsOwedPkr" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block sm:col-span-2">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Paid to</span>
              <input name="paidTo" type="text" className="w-full border rounded px-2 py-1" />
            </label>
            <div className="sm:col-span-4">
              <button type="submit" className="px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white">
                Compute & save zakat
              </button>
              <span className="ml-3 text-xs text-[var(--ink)]/60">Zakat is 2.5% of net zakatable wealth if it meets nisab. Preview at zero: <Pkr value={preview.zakatDuePkr} />.</span>
            </div>
          </form>
        </CardContent>
      </Card>

      <SectionDivider label="Prior assessments" />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No assessments yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Hijri</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Nisab</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Net zakatable</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Due</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Paid</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">To</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.assessmentDate)}</td>
                    <td className="px-3 py-2 tabular text-xs">{r.hijriYear} AH</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.nisabPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.netZakatableWealthPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.zakatDuePkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.paidPkr} /></td>
                    <td className="px-3 py-2 text-xs">{r.paidTo ?? '—'}</td>
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
