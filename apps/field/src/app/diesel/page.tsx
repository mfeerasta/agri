import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BigButton, Masthead } from '@zameen/ui';
import { t } from '@zameen/locale';
import { Fuel, Receipt } from 'lucide-react';
import { getFieldSession } from '../../lib/session';

export default async function DieselLanding() {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  const locale = 'ur';
  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Home</Link>
      <Masthead section={t('nav.diesel', locale)} />
      <Link href="/diesel/log"><BigButton icon={<Fuel />} label={t('diesel.daily_log', locale)} tone="primary" /></Link>
      <Link href="/diesel/purchase"><BigButton icon={<Receipt />} label={t('diesel.purchase', locale)} tone="warning" /></Link>
    </main>
  );
}
