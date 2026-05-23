import { db, fields, blocks, farms, taxPeriods } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';
import { computePunjabAit, PUNJAB_KCT_LAND_SLABS, PUNJAB_INCOME_SLABS } from '@zameen/finance';
import { recordPunjabAit } from '@/lib/finance/tax-actions';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PunjabAitPage() {
  const fieldRows = await db.select({ acres: fields.acres }).from(fields)
    .innerJoin(blocks, eq(blocks.id, fields.blockId))
    .innerJoin(farms, eq(farms.id, blocks.farmId));
  const totalCultivatedAcres = fieldRows.reduce((a, f) => a + Number(f.acres), 0);
  const sample = computePunjabAit({ cultivatedAcres: totalCultivatedAcres });

  const priorRows = await db.select().from(taxPeriods)
    .where(eq(taxPeriods.taxKind, 'punjab_agri_income'))
    .orderBy(desc(taxPeriods.periodEnd))
    .limit(20);

  return (
    <div>
      <Masthead section="PUNJAB AGRI INCOME TAX" />
      <SectionDivider label={`Cultivated acres on record: ${totalCultivatedAcres.toFixed(2)} · land-basis sample ${sample.landBasisPkr} PKR`} />

      <Card>
        <CardHeader><CardTitle>Compute & record return</CardTitle></CardHeader>
        <CardContent>
          <form action={recordPunjabAit} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Period start</span>
              <input name="periodStart" type="date" required className="w-full border rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Period end</span>
              <input name="periodEnd" type="date" required className="w-full border rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Due on</span>
              <input name="dueOn" type="date" required className="w-full border rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Cultivated acres</span>
              <input name="cultivatedAcres" type="number" step="0.01" defaultValue={totalCultivatedAcres.toFixed(2)} required className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Mature orchard acres</span>
              <input name="matureOrchardAcres" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <label className="block">
              <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Net agri income PKR</span>
              <input name="netAgriIncomePkr" type="number" step="0.01" defaultValue="0" className="w-full border rounded px-2 py-1 tabular" />
            </label>
            <div className="sm:col-span-3">
              <button type="submit" className="px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white">
                Compute & draft return
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SectionDivider label="KCT land slabs in force" />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">From acres</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">To acres</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">PKR / acre</th>
              </tr>
            </thead>
            <tbody>
              {PUNJAB_KCT_LAND_SLABS.map((s, i) => (
                <tr key={i} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 tabular">{s.fromAcres}</td>
                  <td className="px-3 py-2 tabular">{s.toAcres ?? '∞'}</td>
                  <td className="px-3 py-2 text-right"><Pkr value={s.amountPerAcrePkr} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SectionDivider label="Income slabs (where higher than land basis)" />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">From PKR</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">To PKR</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Base PKR</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Marginal %</th>
              </tr>
            </thead>
            <tbody>
              {PUNJAB_INCOME_SLABS.map((s, i) => (
                <tr key={i} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 tabular"><Pkr value={s.fromPkr} /></td>
                  <td className="px-3 py-2 tabular">{s.toPkr === null ? '∞' : <Pkr value={s.toPkr} />}</td>
                  <td className="px-3 py-2 text-right"><Pkr value={s.basePkr} /></td>
                  <td className="px-3 py-2 text-right tabular">{s.marginalPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SectionDivider label="Prior returns" />
      <Card>
        <CardContent className="p-0">
          {priorRows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No prior Punjab AIT filings.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Period</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Due</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Computed</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Paid</th>
                </tr>
              </thead>
              <tbody>
                {priorRows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.dueOn)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.filingStatus}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.computedAmountPkr ?? 0} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.paidAmountPkr ?? 0} /></td>
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
