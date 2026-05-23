'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ClipboardList,
  PackageOpen,
  Eye,
  CheckSquare,
  Coins,
  Beef,
  Truck,
  Leaf,
  Zap,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/assign', label: 'Assign', icon: ClipboardList },
  { href: '/issue', label: 'Issue', icon: PackageOpen },
  { href: '/inspect', label: 'Inspect', icon: Eye },
  { href: '/approve', label: 'Approve', icon: CheckSquare },
  { href: '/payroll', label: 'Payroll', icon: Coins },
  { href: '/livestock', label: 'Livestock', icon: Beef },
  { href: '/logistics', label: 'Transport', icon: Truck },
  { href: '/sustainability', label: 'Sustain', icon: Leaf },
  { href: '/energy', label: 'Energy', icon: Zap },
] as const;

export function OpsNavRail() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen sticky top-0 flex-col items-stretch border-r border-[var(--rule)] bg-[var(--paper-2)] py-4">
      <div className="px-3 pb-4 text-center">
        <span className="font-display text-base font-semibold tracking-tight text-[var(--zameen-700)]">
          Z
        </span>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href as never}
              className={`flex flex-col items-center gap-1 rounded-sm px-2 py-3 transition ${
                active
                  ? 'bg-[var(--zameen-700)] text-[var(--paper)]'
                  : 'text-[var(--ink)]/80 hover:bg-[var(--paper)]'
              }`}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span className="smallcaps text-[0.62rem] tracking-wider">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
