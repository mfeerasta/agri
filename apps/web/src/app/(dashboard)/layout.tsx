import { NotificationsBell, HelpDrawer, GlobalSearch, HelpContextProvider } from '@zameen/ui';
import {
  LayoutDashboard,
  MapPin,
  Sprout,
  Boxes,
  Fuel,
  Wrench,
  Beef,
  Users,
  Coins,
  CheckSquare,
  BarChart3,
  ShoppingCart,
  Receipt,
  FileText,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { t } from '@zameen/locale';
import { db, users } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { getLocale } from '@/lib/locale';
import { getSessionContext } from '@/lib/session';
import { ResponsiveNav } from './responsive-nav';
import { LocaleSwitcherWrapper } from './locale-switcher-wrapper';
import { AuditorBanner } from '@/components/auditor-banner';
import { RoleTour } from '@/components/role-tour';
import { tourForRole } from '@/lib/tours';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const isRtl = locale === 'ur' || locale === 'pa';
  const session = await getSessionContext();
  const role = session?.role ?? 'worker';
  const isAuditor = role === 'auditor';

  let alreadySeen = true;
  if (session?.userId) {
    const [row] = await db
      .select({ completed: users.toursCompleted, skipped: users.toursSkipped })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    const def = tourForRole(role);
    if (row && def) {
      const ids = [...(row.completed ?? []), ...(row.skipped ?? [])];
      alreadySeen = ids.includes(def.id);
    }
  }
  const tourDef = tourForRole(role);

  const NAV_ALL = [
    { href: '/', label: t('nav.dashboard', locale), icon: <LayoutDashboard size={16} strokeWidth={1.8} />, tour: 'nav-dashboard' },
    { href: '/fields', label: t('nav.fields', locale), icon: <MapPin size={16} strokeWidth={1.8} />, tour: 'nav-fields' },
    { href: '/crops', label: t('nav.crops', locale), icon: <Sprout size={16} strokeWidth={1.8} />, tour: 'nav-crops' },
    { href: '/inventory', label: t('nav.inventory', locale), icon: <Boxes size={16} strokeWidth={1.8} />, tour: 'nav-inventory' },
    { href: '/diesel', label: t('nav.diesel', locale), icon: <Fuel size={16} strokeWidth={1.8} />, tour: 'nav-diesel' },
    { href: '/repairs', label: t('nav.repairs', locale), icon: <Wrench size={16} strokeWidth={1.8} />, tour: 'nav-repairs' },
    { href: '/livestock', label: t('nav.livestock', locale), icon: <Beef size={16} strokeWidth={1.8} />, tour: 'nav-livestock' },
    { href: '/labor', label: t('nav.labor', locale), icon: <Users size={16} strokeWidth={1.8} />, tour: 'nav-labor' },
    { href: '/procurement', label: t('nav.procurement', locale), icon: <ShoppingCart size={16} strokeWidth={1.8} />, tour: 'nav-procurement' },
    { href: '/sales', label: t('nav.sales', locale), icon: <Receipt size={16} strokeWidth={1.8} />, tour: 'nav-sales' },
    { href: '/finance', label: t('nav.finance', locale), icon: <Coins size={16} strokeWidth={1.8} />, tour: 'nav-finance' },
    { href: '/compliance', label: t('nav.compliance', locale), icon: <FileText size={16} strokeWidth={1.8} />, tour: 'nav-compliance' },
    { href: '/receipts', label: t('nav.receipts', locale), icon: <FileText size={16} strokeWidth={1.8} />, tour: 'nav-receipts' },
    { href: '/approvals', label: t('nav.approvals', locale), icon: <CheckSquare size={16} strokeWidth={1.8} />, tour: 'nav-approvals' },
    { href: '/reports', label: t('nav.reports', locale), icon: <BarChart3 size={16} strokeWidth={1.8} />, tour: 'nav-reports' },
    { href: '/audit', label: 'Audit', icon: <ShieldCheck size={16} strokeWidth={1.8} />, tour: 'nav-audit' },
    { href: '/admin/settings', label: t('nav.admin', locale), icon: <Settings size={16} strokeWidth={1.8} />, tour: 'nav-admin' },
    { href: '/admin/jobs', label: 'Jobs', icon: <Settings size={16} strokeWidth={1.8} /> },
  ];

  const NAV = NAV_ALL.filter((item) => {
    if (item.href === '/audit') return isAuditor || role === 'director' || role === 'super_admin';
    if (isAuditor && item.href.startsWith('/admin')) return false;
    return true;
  });

  return (
    <div
      lang={locale === 'ur' ? 'ur' : locale === 'pa' ? 'pa-PK' : locale === 'hi' ? 'hi' : 'en'}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`flex min-h-screen bg-[var(--bg)] text-[var(--fg)] ${isRtl ? 'flex-row-reverse' : ''}`}
      data-role={role}
    >
      <ResponsiveNav
        items={NAV}
        brandTitle={t('app.title', locale)}
        brandSub="Rupafab Agri · Raiwind"
        statusLabel={t('nav.status', locale)}
        statusValue={t('dashboard.systems_normal', locale)}
        locale={locale}
        rtl={isRtl}
        menuLabel={t('nav.menu', locale)}
      />
      <HelpContextProvider>
        <main className="flex-1 min-w-0 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 max-w-[1500px] mx-auto w-full">
          {isAuditor && <AuditorBanner />}
          <div className={`mb-4 flex items-center gap-3 ${isRtl ? 'justify-start' : 'justify-end'}`}>
            <GlobalSearch />
            <LocaleSwitcherWrapper current={locale} />
            <NotificationsBell />
          </div>
          {children}
          {tourDef && (
            <RoleTour tourId={tourDef.id} steps={tourDef.steps} alreadySeen={alreadySeen} />
          )}
        </main>
        <HelpDrawer />
      </HelpContextProvider>
    </div>
  );
}
