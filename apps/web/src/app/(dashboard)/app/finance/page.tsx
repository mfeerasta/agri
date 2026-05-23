import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, StatBlock, Pkr } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';
import { FxWidget } from './fx-widget';

export default async function FinanceHome() {
  const locale = await getLocale();
  const TILES = [
    { href: '/finance/accounts', label: t('finance.accounts', locale), sub: 'Ledger' },
    { href: '/finance/journal', label: t('finance.journal', locale), sub: 'Audit walk' },
    { href: '/finance/cost-allocations', label: t('finance.cost_allocations', locale), sub: 'Per field, per pool' },
    { href: '/finance/field-ledger', label: 'Field ledger', sub: 'Combined daily per-plot pivot' },
    { href: '/finance/field-pnl', label: t('finance.field_pnl', locale), sub: 'Killer feature' },
    { href: '/finance/cash-flow', label: t('finance.cash_flow', locale), sub: '90-day forecast' },
    { href: '/finance/reconciliation/inputs', label: t('finance.reconciliation', locale), sub: 'Inputs · Diesel · Bank' },
    { href: '/finance/statements', label: t('finance.statements', locale, 'Statements'), sub: 'PDF + XLSX export' },
    { href: '/finance/tax', label: 'Tax, zakat, ushr', sub: 'Punjab AIT · FBR · 2.5% · 5%/10%' },
  ];
  return (
    <div>
      <Masthead section={t('finance.title', locale)} />
      <SectionDivider />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label={t('dashboard.cash_on_hand', locale)} value={<Pkr value={0} mode="lac_crore" />} caption="Soneri" />
        <StatBlock label={t('finance.payables_30d', locale)} value={<Pkr value={0} mode="lac_crore" />} />
        <StatBlock label={t('finance.receivables_30d', locale)} value={<Pkr value={0} mode="lac_crore" />} />
        <StatBlock label={t('finance.burn_30d', locale)} value={<Pkr value={0} mode="lac_crore" />} />
      </div>
      <SectionDivider label="Foreign exchange" />
      <FxWidget />
      <SectionDivider label={t('finance.navigate', locale)} />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href as never} className="block">
            <Card className="hover:bg-[var(--paper-2)]">
              <CardHeader><CardTitle>{tile.label}</CardTitle></CardHeader>
              <CardContent className="smallcaps text-[0.7rem] text-[var(--ink)]/60">{tile.sub}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
