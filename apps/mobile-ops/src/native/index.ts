/**
 * Native runtime detection. Re-exported to every other native wrapper so
 * each one can short-circuit cleanly when running in a regular browser (e.g.
 * `pnpm dev` against the field PWA, e2e tests, etc.).
 */

import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): 'ios' | 'android' | 'web' => {
  const p = Capacitor.getPlatform();
  if (p === 'ios' || p === 'android') return p;
  return 'web';
};
