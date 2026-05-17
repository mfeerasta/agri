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
} from 'lucide-react';
import { t } from '@zameen/locale';
import { getLocale } from '@/lib/locale';
import { ResponsiveNav } from './responsive-nav';
import { LocaleSwitcherWrapper } from './locale-switcher-wrapper';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const isRtl = locale === 'ur';

  const NAV = [
    { href: '/', label: t('nav.dashboard', locale), icon: <LayoutDashboard size={16} strokeWidth={1.8} /> },
    { href: '/fields', label: t('nav.fields', locale), icon: <MapPin size={16} strokeWidth={1.8} /> },
    { href: '/crops', label: t('nav.crops', locale), icon: <Sprout size={16} strokeWidth={1.8} /> },
    { href: '/inventory', label: t('nav.inventory', locale), icon: <Boxes size={16} strokeWidth={1.8} /> },
    { href: '/diesel', label: t('nav.diesel', locale), icon: <Fuel size={16} strokeWidth={1.8} /> },
    { href: '/repairs', label: t('nav.repairs', locale), icon: <Wrench size={16} strokeWidth={1.8} /> },
    { href: '/livestock', label: t('nav.livestock', locale), icon: <Beef size={16} strokeWidth={1.8} /> },
    { href: '/labor', label: t('nav.labor', locale), icon: <Users size={16} strokeWidth={1.8} /> },
    { href: '/procurement', label: t('nav.procurement', locale), icon: <ShoppingCart size={16} strokeWidth={1.8} /> },
    { href: '/sales', label: t('nav.sales', locale), icon: <Receipt size={16} strokeWidth={1.8} /> },
    { href: '/finance', label: t('nav.finance', locale), icon: <Coins size={16} strokeWidth={1.8} /> },
    { href: '/compliance', label: t('nav.compliance', locale), icon: <FileText size={16} strokeWidth={1.8} /> },
    { href: '/approvals', label: t('nav.approvals', locale), icon: <CheckSquare size={16} strokeWidth={1.8} /> },
    { href: '/reports', label: t('nav.reports', locale), icon: <BarChart3 size={16} strokeWidth={1.8} /> },
    { href: '/admin/settings', label: t('nav.admin', locale), icon: <Settings size={16} strokeWidth={1.8} /> },
  ];

  return (
    <div
      lang={locale === 'ur' ? 'ur' : 'en'}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`flex min-h-screen bg-[var(--bg)] text-[var(--fg)] ${isRtl ? 'flex-row-reverse' : ''}`}
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
          <div className={`mb-4 flex items-center gap-3 ${isRtl ? 'justify-start' : 'justify-end'}`}>
            <GlobalSearch />
            <LocaleSwitcherWrapper current={locale} />
            <NotificationsBell />
          </div>
          {children}
        </main>
        <HelpDrawer />
      </HelpContextProvider>
    </div>
  );
}
