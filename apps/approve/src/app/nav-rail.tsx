'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, History, UserCog, AlertTriangle, Wallet } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Queue', icon: Inbox },
  { href: '/history', label: 'History', icon: History },
  { href: '/delegate', label: 'Delegate', icon: UserCog },
  { href: '/emergency-log', label: 'Emergency', icon: AlertTriangle },
  { href: '/cash-position', label: 'Cash', icon: Wallet },
];

export function ApproverNavRail() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-[var(--rule)] bg-[var(--paper)]">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== '/' && path?.startsWith(href));
        return (
          <Link
            key={href}
            href={href as never}
            className={`flex flex-col items-center gap-1 py-2 ${active ? 'text-[var(--zameen-700)]' : 'text-[var(--ink)]/60'}`}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span className="smallcaps text-[0.6rem]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
