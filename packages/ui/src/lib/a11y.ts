/**
 * Accessibility hooks for modals, drawers, kanban boards, and sidebar
 * navigation. Designed to be opt-in: pass a ref + active flag and the
 * hook wires up the appropriate listeners.
 *
 * - `useFocusTrap` keeps focus inside an open dialog / drawer.
 * - `useEscapeKey` invokes a callback when Escape is pressed.
 * - `useKeyboardNav` provides arrow-key navigation across a list of focusable items.
 */

'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable()[0];
    first?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    root.addEventListener('keydown', handler);
    return () => {
      root.removeEventListener('keydown', handler);
      previouslyFocused?.focus?.();
    };
  }, [ref, active]);
}

export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onEscape]);
}

interface KeyboardNavOptions {
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  onSelect?: (index: number, element: HTMLElement) => void;
}

export function useKeyboardNav(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options: KeyboardNavOptions = {},
): void {
  const { orientation = 'vertical', loop = true, onSelect } = options;
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const handler = (event: KeyboardEvent) => {
      const items = Array.from(root.querySelectorAll<HTMLElement>('[data-kbd-item]'));
      if (items.length === 0) return;
      const currentIndex = items.findIndex((el) => el === document.activeElement);
      let nextIndex = currentIndex;
      const isVertical = orientation !== 'horizontal';
      const isHorizontal = orientation !== 'vertical';
      if (isVertical && event.key === 'ArrowDown') nextIndex = currentIndex + 1;
      else if (isVertical && event.key === 'ArrowUp') nextIndex = currentIndex - 1;
      else if (isHorizontal && event.key === 'ArrowRight') nextIndex = currentIndex + 1;
      else if (isHorizontal && event.key === 'ArrowLeft') nextIndex = currentIndex - 1;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = items.length - 1;
      else if (event.key === 'Enter' || event.key === ' ') {
        if (currentIndex >= 0 && onSelect) {
          event.preventDefault();
          onSelect(currentIndex, items[currentIndex]!);
        }
        return;
      } else {
        return;
      }
      if (nextIndex < 0) nextIndex = loop ? items.length - 1 : 0;
      if (nextIndex >= items.length) nextIndex = loop ? 0 : items.length - 1;
      event.preventDefault();
      items[nextIndex]?.focus();
    };
    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, [ref, active, orientation, loop, onSelect]);
}

/**
 * Combine accessible name + status text so colour is never the only signal.
 * Pair with a CSS dot indicator: `<span aria-hidden="true" className="dot" />`
 * followed by `<span className="sr-only">{statusLabel(status)}</span>`.
 */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    critical: 'Critical anomaly',
    warning: 'Warning',
    healthy: 'Healthy',
    offline: 'Offline',
    syncing: 'Syncing',
    synced: 'Synced',
  };
  return map[status] ?? status;
}
