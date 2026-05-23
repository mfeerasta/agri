import { Masthead, SectionDivider } from '@zameen/ui';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';
import { StatementsPanel } from './statements-panel';

export default async function StatementsPage(): Promise<React.JSX.Element> {
  const locale = await getLocale();
  return (
    <div>
      <Masthead section={t('finance.statements', locale, 'Financial Statements')} />
      <SectionDivider />
      <StatementsPanel />
    </div>
  );
}
