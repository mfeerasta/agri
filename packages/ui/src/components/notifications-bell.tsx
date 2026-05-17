'use client';

/**
 * Notifications bell with unread badge. Polls /api/notifications/unread
 * every 30 seconds. Click opens a dropdown listing recent unread items
 * fetched from /api/notifications/recent. Tapping an item marks it read
 * and navigates to its deepLink.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  bodyUr: string | null;
  deepLink: string | null;
  createdAt: string;
  category: string;
}

const POLL_INTERVAL_MS = 30_000;

export function NotificationsBell({
  unreadEndpoint = '/api/notifications/unread',
  recentEndpoint = '/api/notifications/recent',
  markReadEndpoint = '/api/notifications',
}: {
  unreadEndpoint?: string;
  recentEndpoint?: string;
  markReadEndpoint?: string;
}): JSX.Element {
  const [count, setCount] = useState<number>(0);
  const [open, setOpen] = useState<boolean>(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchCount = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(unreadEndpoint, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      setCount(typeof data.count === 'number' ? data.count : 0);
    } catch {
      // network blip; next tick retries
    }
  }, [unreadEndpoint]);

  const fetchRecent = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch(recentEndpoint, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: NotificationItem[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [recentEndpoint]);

  useEffect(() => {
    void fetchCount();
    const t = window.setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [fetchCount]);

  useEffect(() => {
    function onDocClick(e: MouseEvent): void {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggle = useCallback((): void => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void fetchRecent();
      return next;
    });
  }, [fetchRecent]);

  const handleItemClick = useCallback(
    async (item: NotificationItem): Promise<void> => {
      try {
        await fetch(`${markReadEndpoint}/${item.id}/read`, { method: 'POST' });
      } catch {
        // ignore mark-read failure; navigation still occurs
      }
      setItems((prev) => prev.filter((n) => n.id !== item.id));
      setCount((prev) => Math.max(0, prev - 1));
      if (item.deepLink) window.location.href = item.deepLink;
    },
    [markReadEndpoint],
  );

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label="Notifications"
        onClick={toggle}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-[var(--fg-muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
      >
        <Bell size={18} strokeWidth={1.8} />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-[var(--danger,#c0392b)] text-white text-[10px] leading-[16px] text-center px-1 font-medium">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[340px] max-h-[420px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg z-50">
          <div className="px-4 py-3 border-b border-[var(--border)] text-sm font-medium">
            Notifications
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-[var(--fg-muted)]">Loading...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[var(--fg-muted)]">No unread notifications</div>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void handleItemClick(item);
                    }}
                    className="w-full text-left px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                  >
                    <div className="text-sm font-medium text-[var(--fg)]">{item.title}</div>
                    <div className="text-xs text-[var(--fg-muted)] mt-1 line-clamp-2">{item.body}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
