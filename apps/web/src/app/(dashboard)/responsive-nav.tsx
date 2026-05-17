'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { LocaleSwitcher, type SwitcherLocale } from '@zameen/ui';
import { updateMyLocale } from '@/modules/profile/actions';

export interface NavItem {
  href: string;
  label: string;
  iconName: string;
}

export interface ResponsiveNavProps {
  items: { href: string; label: string; icon: React.ReactNode }[];
  brandTitle: string;
  brandSub: string;
  statusLabel: string;
  statusValue: string;
  locale: SwitcherLocale;
  rtl: boolean;
  menuLabel: string;
}

export function ResponsiveNav({
  items,
  brandTitle,
  brandSub,
  statusLabel,
  statusValue,
  locale,
  rtl,
  menuLabel,
}: ResponsiveNavProps) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sideClass = rtl ? 'right-0 border-l' : 'left-0 border-r';
  const slideFrom = rtl ? 'translate-x-full' : '-translate-x-full';

  return (
    <>
      {/* Mobile top bar */}
      <div className="sm:hidden sticky top-0 z-40 flex items-center justify-between bg-[var(--bg-2)] border-b border-[var(--border)] px-3 py-2">
        <button
          type="button"
          aria-label={menuLabel}
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] min-h-[44px] min-w-[44px]"
        >
          <Menu size={20} strokeWidth={1.8} />
        </button>
        <div className="font-display text-lg font-semibold tracking-tight">{brandTitle}</div>
        <LocaleSwitcher current={locale} onChange={(l) => updateMyLocale(l)} />
      </div>

      {/* Desktop / Tablet sidebar */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={[
          'hidden sm:flex flex-col sticky top-0 h-screen overflow-y-auto border-[var(--border)] bg-[var(--bg-2)] px-3 py-5',
          rtl ? 'order-2 border-l' : 'border-r',
          // md tablet rail 56px; expand to 240 on hover; lg always 240
          'transition-[width] duration-200',
          expanded ? 'w-[240px]' : 'sm:w-[56px] lg:w-[240px]',
        ].join(' ')}
        aria-label="Primary navigation"
      >
        <Link href={'/' as never} className="block mb-6 group">
          <div className="font-display text-2xl font-semibold tracking-tight text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors whitespace-nowrap">
            {brandTitle}
          </div>
          <div className={`smallcaps mt-1 whitespace-nowrap ${expanded ? 'block' : 'hidden lg:block'}`}>
            {brandSub}
          </div>
        </Link>
        <nav className="space-y-0.5">
          {items.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href as never}
              title={label}
              className="flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors min-h-[40px]"
            >
              <span className="shrink-0">{icon}</span>
              <span className={`${expanded ? 'inline' : 'hidden lg:inline'}`}>{label}</span>
            </Link>
          ))}
        </nav>
        <div className={`mt-8 pt-4 border-t border-[var(--border)] ${expanded ? 'block' : 'hidden lg:block'}`}>
          <div className="smallcaps mb-2">{statusLabel}</div>
          <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            {statusValue}
          </div>
        </div>
      </aside>

      {/* Mobile slide-in */}
      {open ? (
        <div className="sm:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className={[
              'absolute top-0 bottom-0 w-[260px] bg-[var(--bg-2)] px-4 py-5 overflow-y-auto',
              sideClass,
              'transform transition-transform duration-200',
              open ? 'translate-x-0' : slideFrom,
            ].join(' ')}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="font-display text-2xl font-semibold tracking-tight">{brandTitle}</div>
                <div className="smallcaps mt-1">{brandSub}</div>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] min-h-[44px] min-w-[44px]"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>
            <nav className="space-y-0.5">
              {items.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href as never}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-[8px] px-3 py-3 text-sm text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] min-h-[44px]"
                >
                  <span className="shrink-0">{icon}</span>
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-8 pt-4 border-t border-[var(--border)]">
              <div className="smallcaps mb-2">{statusLabel}</div>
              <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                {statusValue}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
