import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BigButton, Masthead } from '@zameen/ui';
import { t, formatDateLocalized } from '@zameen/locale';
import { Clock, Fuel, Wrench, Wheat, PackageOpen, MilkOff, ListChecks, Camera, User, ImageDown, Stethoscope } from 'lucide-react';
import { getFieldSession } from '../lib/session';
import { SyncBadge } from '../components/sync-badge';
import { LocaleToggle } from '../components/locale-toggle';

export default async function FieldHome() {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  const locale = 'ur';
  const today = new Date();

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/profile" className="inline-flex items-center gap-2 min-h-[44px]" aria-label={t('nav.profile', locale)}>
            <User size={18} strokeWidth={1.5} />
            <span className="urdu text-sm">{session.workerName}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge />
          <LocaleToggle />
        </div>
      </div>

      <Masthead section={t('app.title', locale)} date={today} />
      <p className="tabular text-xs text-[var(--ink)]/60">{formatDateLocalized(today, locale)}</p>

      <Link href="/attendance"><BigButton icon={<Clock />} label={t('attendance.title', locale)} tone="success" /></Link>
      <Link href="/tasks"><BigButton icon={<ListChecks />} label={t('task.list', locale)} tone="primary" /></Link>
      <Link href="/diesel"><BigButton icon={<Fuel />} label={t('nav.diesel', locale)} tone="primary" /></Link>
      <Link href="/repair/new"><BigButton icon={<Wrench />} label={t('repair.request', locale)} tone="warning" /></Link>
      <Link href="/harvest"><BigButton icon={<Wheat />} label={t('harvest.title', locale)} tone="success" /></Link>
      <Link href="/diagnose"><BigButton icon={<Stethoscope />} label="فصل کی تشخیص" tone="warning" /></Link>
      <Link href="/issuance"><BigButton icon={<PackageOpen />} label={t('issuance.title', locale)} tone="neutral" /></Link>
      <Link href="/livestock"><BigButton icon={<MilkOff />} label={t('livestock.title', locale)} tone="neutral" /></Link>
      <Link href="/photos"><BigButton icon={<ImageDown />} label={t('photo.queue', locale)} tone="neutral" /></Link>
      <Link href="/profile"><BigButton icon={<Camera />} label={t('nav.profile', locale)} tone="neutral" /></Link>
    </main>
  );
}
