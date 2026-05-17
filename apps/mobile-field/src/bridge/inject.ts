/**
 * Bridge installer. Runs inside the Capacitor WebView before the field PWA
 * boots. It installs `window.__zameenNative__` so the PWA code can prefer
 * native camera, GPS, push, and durable-offline storage when running inside
 * the native shell, without any of the PWA's source needing to import
 * `@capacitor/*`. The PWA's web bundle stays free of native deps.
 */

import { isNative, platform } from '../native/index';
import { takePhoto } from '../native/camera';
import { getCurrentPosition } from '../native/gps';
import { registerForPush } from '../native/push';
import { enqueueOp, readAll, clear } from '../native/offline';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';

export interface ZameenNative {
  readonly platform: 'ios' | 'android' | 'web';
  readonly isNative: boolean;
  takePhoto: typeof takePhoto;
  getCurrentPosition: typeof getCurrentPosition;
  registerForPush: typeof registerForPush;
  offline: {
    enqueueOp: typeof enqueueOp;
    readAll: typeof readAll;
    clear: typeof clear;
  };
  onResume: (cb: () => void) => () => void;
  onNetworkChange: (cb: (online: boolean) => void) => () => void;
}

declare global {
  interface Window {
    __zameenNative__?: ZameenNative;
  }
}

export function install(): void {
  if (typeof window === 'undefined') return;
  if (window.__zameenNative__) return;

  const bridge: ZameenNative = {
    platform: platform(),
    isNative: isNative(),
    takePhoto,
    getCurrentPosition,
    registerForPush,
    offline: { enqueueOp, readAll, clear },
    onResume: (cb) => {
      const handle = App.addListener('appStateChange', (s) => {
        if (s.isActive) cb();
      });
      return () => {
        handle.then((l) => l.remove()).catch(() => undefined);
      };
    },
    onNetworkChange: (cb) => {
      const handle = Network.addListener('networkStatusChange', (s) => cb(s.connected));
      return () => {
        handle.then((l) => l.remove()).catch(() => undefined);
      };
    },
  };

  window.__zameenNative__ = bridge;
  document.documentElement.classList.add('capacitor-native', `capacitor-${platform()}`);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
}
