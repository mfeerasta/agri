import { Masthead, SectionDivider } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';
import Link from 'next/link';
import { StatementsPanel } from './statements-panel';

export default async function StatementsPage(): Promise<React.JSX.Element> {
  const locale = await getLocale();
  return (
    <div>
      <Masthead section={t('finance.statements', locale, 'Financial Statements')} />
      <SectionDivider />
      <StatementsPanel />
      <div className="mt-4">
        <Link href={'/finance/statements/rent-summary' as never} className="px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white inline-block">
          Rent &amp; sharecrop summary →
        </Link>
        <Link href={'/finance/statements/sales-backlog' as never} className="ml-2 px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white inline-block">
          Sales backlog →
        </Link>
        <Link href={'/finance/statements/procurement-summary' as never} className="ml-2 px-3 py-1 text-sm border rounded bg-[var(--ink)] text-white inline-block">
          Procurement summary →
        </Link>
      </div>
    </div>
  );
}
