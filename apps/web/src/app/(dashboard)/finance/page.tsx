import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, StatBlock, Pkr } from '@zameen/ui';

const TILES = [
  { href: '/finance/accounts', label: 'Chart of accounts', sub: 'Ledger' },
  { href: '/finance/journal', label: 'Journal entries', sub: 'Audit walk' },
  { href: '/finance/cost-allocations', label: 'Cost allocations', sub: 'Per field, per pool' },
  { href: '/finance/field-pnl', label: 'Field P&L', sub: 'Killer feature' },
  { href: '/finance/cash-flow', label: 'Cash flow', sub: '90-day forecast' },
  { href: '/finance/reconciliation/inputs', label: 'Stock recon', sub: 'Inputs · Diesel · Bank' },
];

export default function FinanceHome() {
  return (
    <div>
      <Masthead section="FINANCE" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label="Cash on hand" value={<Pkr value={0} mode="lac_crore" />} caption="Soneri" />
        <StatBlock label="Payables 30d" value={<Pkr value={0} mode="lac_crore" />} />
        <StatBlock label="Receivables 30d" value={<Pkr value={0} mode="lac_crore" />} />
        <StatBlock label="Burn 30d" value={<Pkr value={0} mode="lac_crore" />} />
      </div>
      <SectionDivider label="Navigate" />
      <div className="grid gap-3 md:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href as never} className="block">
            <Card className="hover:bg-[var(--paper-2)]">
              <CardHeader><CardTitle>{t.label}</CardTitle></CardHeader>
              <CardContent className="smallcaps text-[0.7rem] text-[var(--ink)]/60">{t.sub}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
