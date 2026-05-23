import Link from 'next/link';
import { db, taxPeriods, TAX_KIND_LABELS, type TaxKind } from '@zameen/db';
import { asc, inArray } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const KINDS = Object.keys(TAX_KIND_LABELS) as TaxKind[];

export default async function TaxHubPage() {
  const rows = await db.select().from(taxPeriods).orderBy(asc(taxPeriods.dueOn));
  const upcoming = await db
    .select()
    .from(taxPeriods)
    .where(inArray(taxPeriods.filingStatus, ['pending', 'prepared', 'overdue']))
    .orderBy(asc(taxPeriods.dueOn))
    .limit(30);
  const byKind = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.taxKind] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <Masthead section="TAX, ZAKAT, USHR" />
      <SectionDivider label="Compliance modules" />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleTile href="/finance/tax/periods" title="Tax periods" sub="All kinds, all filings" />
        <ModuleTile href="/finance/tax/ushr" title="Ushr settlements" sub="5pct irrigated / 10pct rain-fed" />
        <ModuleTile href="/finance/tax/zakat" title="Zakat assessment" sub="Annual hijri-year roll-up" />
        <ModuleTile href="/finance/tax/punjab-agri-income" title="Punjab Agri Income Tax" sub="KCT slabs + draft return" />
        <ModuleTile href="/finance/tax/ntn-strn" title="NTN / STRN" sub="FBR + PRA registrations" />
        <ModuleTile href="/finance/statements" title="Tax summary report" sub="Period roll-up" />
      </div>

      <SectionDivider label="By kind" />
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KINDS.map((k) => {
          const list = byKind[k] ?? [];
          const total = list.reduce((a, r) => a + Number(r.computedAmountPkr ?? 0), 0);
          return (
            <Card key={k}>
              <CardHeader><CardTitle className="text-xs">{TAX_KIND_LABELS[k]}</CardTitle></CardHeader>
              <CardContent className="text-xs">
                <div className="smallcaps text-[var(--ink)]/60">{list.length} periods</div>
                <div><Pkr value={total} mode="lac_crore" /></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <SectionDivider label="Upcoming due" />
      <Card>
        <CardContent className="p-0">
          {upcoming.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No upcoming filings.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Due</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Period</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Computed</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.dueOn)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{TAX_KIND_LABELS[r.taxKind as TaxKind] ?? r.taxKind}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.filingStatus}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.computedAmountPkr ?? 0} /></td>
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

function ModuleTile({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href as never} className="block">
      <Card className="hover:bg-[var(--paper-2)]">
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="smallcaps text-[0.7rem] text-[var(--ink)]/60">{sub}</CardContent>
      </Card>
    </Link>
  );
}
