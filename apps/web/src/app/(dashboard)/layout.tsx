import Link from 'next/link';
import { NotificationsBell } from '@zameen/ui';
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

const NAV: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fields', label: 'Fields', icon: MapPin },
  { href: '/crops', label: 'Crops', icon: Sprout },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/diesel', label: 'Diesel', icon: Fuel },
  { href: '/repairs', label: 'Repairs', icon: Wrench },
  { href: '/livestock', label: 'Livestock', icon: Beef },
  { href: '/labor', label: 'Labor', icon: Users },
  { href: '/procurement', label: 'Procurement', icon: ShoppingCart },
  { href: '/sales', label: 'Sales', icon: Receipt },
  { href: '/finance', label: 'Finance', icon: Coins },
  { href: '/compliance', label: 'Compliance', icon: FileText },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/settings', label: 'Admin', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-[var(--bg)] text-[var(--fg)]">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-2)] px-4 py-5">
        <Link href={'/' as never} className="block mb-8 group">
          <div className="font-display text-2xl font-semibold tracking-tight text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
            Zameen
          </div>
          <div className="smallcaps mt-1">Rupafab Agri · Raiwind</div>
        </Link>
        <nav className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href as never}
              className="flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-8 pt-4 border-t border-[var(--border)]">
          <div className="smallcaps mb-2">Status</div>
          <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            All systems normal
          </div>
        </div>
      </aside>
      <main className="px-8 py-8 max-w-[1500px] mx-auto w-full">
        <div className="flex justify-end mb-4">
          <NotificationsBell />
        </div>
        {children}
      </main>
    </div>
  );
}
